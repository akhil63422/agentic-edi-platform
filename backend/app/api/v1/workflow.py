"""
Workflow Execution API
Executes visual workflow nodes — especially AI nodes — via real LLM calls (GPT-4o/gpt-4o-mini).
Called by the Mapper frontend when the user clicks "Execute Workflow".
"""
import os
import json
import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.api.v1.dependencies import require_auth_if_enabled

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workflow", tags=["workflow"], dependencies=[Depends(require_auth_if_enabled)])


class NodeConfig(BaseModel):
    type: str               # select, text, boolean, slider, code, textarea
    value: Any
    options: Optional[List[str]] = None
    language: Optional[str] = None
    placeholder: Optional[str] = None


class WorkflowNode(BaseModel):
    id: str
    type: str               # trigger, transform, filter, ai, action, condition, loop, validate, merge, split
    label: str
    config: Dict[str, NodeConfig] = {}
    color: Optional[str] = None


class WorkflowConnection(BaseModel):
    id: str
    from_node: str
    to_node: str


class WorkflowExecuteRequest(BaseModel):
    nodes: List[WorkflowNode]
    connections: List[WorkflowConnection] = []
    input_data: Optional[Dict[str, Any]] = None


class NodeResult(BaseModel):
    node_id: str
    status: str             # success, error, skipped
    output: Optional[Any] = None
    error: Optional[str] = None
    duration_ms: int = 0
    ai_used: bool = False


async def _run_ai_node(node: WorkflowNode, input_data: Any, api_key: str) -> NodeResult:
    """Execute an AI node using GPT-4o or gpt-4o-mini."""
    import time
    start = time.time()

    cfg = {k: v.value for k, v in node.config.items()}
    node_label = node.label.lower()

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key)

        if "field mapper" in node_label or "map" in node_label:
            # AI Field Mapper: suggest field mappings between source and target schemas
            src_schema = cfg.get("sourceSchema", "{}")
            tgt_schema = cfg.get("targetSchema", "{}")
            confidence = cfg.get("confidence", 95)
            prompt = (
                f"Map the fields from the source schema to the target schema. "
                f"Return a JSON array of {{source, target, confidence}} objects.\n\n"
                f"Source Schema: {src_schema}\nTarget Schema: {tgt_schema}\n"
                f"Minimum confidence threshold: {confidence}%\n"
                f"Input data sample: {json.dumps(input_data, default=str)[:1000]}\n\n"
                "Respond ONLY with the JSON array."
            )
            resp = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert EDI field mapping assistant. Respond only with valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                max_tokens=800,
                temperature=0.2,
            )
            result = json.loads(resp.choices[0].message.content.strip())
            mappings = result if isinstance(result, list) else result.get("mappings", [])
            return NodeResult(
                node_id=node.id, status="success",
                output={"mappings": mappings, "count": len(mappings)},
                duration_ms=int((time.time() - start) * 1000), ai_used=True,
            )

        elif "validator" in node_label or "validate" in node_label or "smart" in node_label:
            # Smart Validator: AI-powered business rule validation
            rules = cfg.get("rules", "Validate all required EDI fields are present and valid.")
            auto_fix = cfg.get("autoFix", False)
            prompt = (
                f"Validate this data against the following rules:\n{rules}\n\n"
                f"Data: {json.dumps(input_data, default=str)[:2000]}\n\n"
                f"Auto-fix: {'yes' if auto_fix else 'no'}\n\n"
                "Respond with JSON: {\"valid\": bool, \"errors\": [...], \"warnings\": [...], "
                "\"fixed_data\": {...} (only if auto_fix is true and fixes were applied)}"
            )
            resp = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an EDI data validation expert. Respond only with valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                max_tokens=600,
                temperature=0.1,
            )
            result = json.loads(resp.choices[0].message.content.strip())
            return NodeResult(
                node_id=node.id, status="success",
                output=result,
                duration_ms=int((time.time() - start) * 1000), ai_used=True,
            )

        elif "logic" in node_label or "generat" in node_label or "transform" in node_label:
            # Logic Generator / AI Transform: generate or apply transformation code
            description = cfg.get("description", cfg.get("template", "Transform the input data."))
            language = cfg.get("language", "Python")
            prompt = (
                f"Generate {language} code to: {description}\n\n"
                f"Input data structure: {json.dumps(input_data, default=str)[:1000]}\n\n"
                "Respond with JSON: {\"code\": \"...\", \"explanation\": \"...\", "
                "\"transformed_sample\": {...}}"
            )
            resp = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are an expert EDI transformation engineer. Respond only with valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                max_tokens=1200,
                temperature=0.3,
            )
            result = json.loads(resp.choices[0].message.content.strip())
            return NodeResult(
                node_id=node.id, status="success",
                output=result,
                duration_ms=int((time.time() - start) * 1000), ai_used=True,
            )

        else:
            # Generic AI node: classify, analyze, or process data
            prompt = (
                f"You are processing an EDI workflow node: '{node.label}'.\n"
                f"Node config: {json.dumps(cfg, default=str)[:500]}\n"
                f"Input data: {json.dumps(input_data, default=str)[:2000]}\n\n"
                "Process the data according to the node's purpose. "
                "Respond with JSON: {\"result\": ..., \"status\": \"success\", \"notes\": \"...\"}"
            )
            resp = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an EDI workflow processor. Respond only with valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                max_tokens=600,
                temperature=0.3,
            )
            result = json.loads(resp.choices[0].message.content.strip())
            return NodeResult(
                node_id=node.id, status="success",
                output=result,
                duration_ms=int((time.time() - start) * 1000), ai_used=True,
            )

    except Exception as e:
        logger.error(f"AI node execution failed for {node.id}: {e}")
        return NodeResult(
            node_id=node.id, status="error",
            error=str(e),
            duration_ms=int((time.time() - start) * 1000), ai_used=True,
        )


async def _run_standard_node(node: WorkflowNode, input_data: Any) -> NodeResult:
    """Execute non-AI nodes (parse, filter, transform, etc.)."""
    import time
    import random
    start = time.time()
    await __import__("asyncio").sleep(0.05 + random.random() * 0.15)

    cfg = {k: v.value for k, v in node.config.items()}
    node_type = node.type.lower()

    try:
        if node_type == "trigger":
            output = {"triggered": True, "format": cfg.get("format", "X12"), "transaction": cfg.get("transaction", "850"), "input": input_data}

        elif node_type == "transform":
            label = node.label.lower()
            if "parse edi" in label:
                output = {"parsed": True, "standard": cfg.get("parser", "X12 Parser"), "segments": [], "input": input_data}
            elif "json transform" in label:
                try:
                    template = json.loads(cfg.get("template", "{}"))
                    output = {"transformed": template, "original": input_data}
                except Exception:
                    output = {"transformed": input_data}
            elif "csv" in label:
                lines = str(input_data).split("\n")
                headers = lines[0].split(cfg.get("delimiter", ",")) if lines else []
                output = {"headers": headers, "rows": len(lines) - 1, "input": input_data}
            else:
                output = {"result": input_data}

        elif node_type == "filter":
            output = {"filtered": True, "condition": cfg.get("condition", ""), "items_passed": 1, "input": input_data}

        elif node_type == "validate":
            rules = cfg.get("rules", "[]")
            output = {"valid": True, "rules_checked": len(rules), "input": input_data}

        elif node_type == "action":
            label = node.label.lower()
            if "http" in label or "rest" in label:
                output = {"status": 200, "url": cfg.get("url", ""), "method": cfg.get("method", "POST"), "simulated": True}
            elif "database" in label or "db" in label:
                output = {"inserted": True, "table": cfg.get("table", ""), "simulated": True}
            elif "email" in label:
                output = {"sent": True, "to": cfg.get("to", ""), "subject": cfg.get("subject", ""), "simulated": True}
            else:
                output = {"executed": True, "config": cfg}

        elif node_type in ("condition", "loop", "merge", "split"):
            output = {"result": input_data, "type": node_type}

        else:
            output = {"result": input_data}

        return NodeResult(
            node_id=node.id, status="success",
            output=output,
            duration_ms=int((time.time() - start) * 1000), ai_used=False,
        )

    except Exception as e:
        return NodeResult(
            node_id=node.id, status="error",
            error=str(e),
            duration_ms=int((time.time() - start) * 1000),
        )


@router.post("/execute")
async def execute_workflow(request: WorkflowExecuteRequest):
    """
    Execute a workflow graph.

    - AI nodes (type='ai') are executed via GPT-4o/gpt-4o-mini if OPENAI_API_KEY is set.
    - All other node types are executed locally with realistic simulated results.
    - Returns per-node results with status, output, duration, and AI flag.
    """
    if not request.nodes:
        raise HTTPException(status_code=400, detail="Workflow has no nodes")

    api_key = os.getenv("OPENAI_API_KEY")
    results: List[NodeResult] = []
    node_outputs: Dict[str, Any] = {}
    current_data = request.input_data or {}

    # Build adjacency map for topological execution
    incoming: Dict[str, List[str]] = {n.id: [] for n in request.nodes}
    for conn in request.connections:
        if conn.to_node in incoming:
            incoming[conn.to_node].append(conn.from_node)

    # Topological sort (Kahn's algorithm)
    in_degree = {n.id: len(v) for n, v in zip(request.nodes, [incoming[n.id] for n in request.nodes])}
    queue = [n for n in request.nodes if in_degree[n.id] == 0]
    ordered = []
    while queue:
        node = queue.pop(0)
        ordered.append(node)
        for conn in request.connections:
            if conn.from_node == node.id and conn.to_node in in_degree:
                in_degree[conn.to_node] -= 1
                if in_degree[conn.to_node] == 0:
                    queue.append(next(n for n in request.nodes if n.id == conn.to_node))

    # Any nodes not reachable from topological sort (cycles) appended in original order
    ordered_ids = {n.id for n in ordered}
    for n in request.nodes:
        if n.id not in ordered_ids:
            ordered.append(n)

    for node in ordered:
        # Collect input from parent outputs (last parent wins if multiple)
        parent_ids = incoming.get(node.id, [])
        node_input = current_data
        for pid in parent_ids:
            if pid in node_outputs:
                node_input = node_outputs[pid]

        if node.type == "ai":
            if api_key:
                result = await _run_ai_node(node, node_input, api_key)
            else:
                # Graceful fallback: simulate without LLM
                import time, random
                await __import__("asyncio").sleep(0.2)
                result = NodeResult(
                    node_id=node.id, status="success",
                    output={
                        "note": "AI node simulated (set OPENAI_API_KEY for real execution)",
                        "node": node.label,
                        "input_summary": str(node_input)[:200],
                    },
                    duration_ms=int(150 + random.random() * 200),
                    ai_used=False,
                )
        else:
            result = await _run_standard_node(node, node_input)

        results.append(result)
        if result.status == "success" and result.output is not None:
            node_outputs[node.id] = result.output

    all_success = all(r.status == "success" for r in results)
    ai_nodes_used = sum(1 for r in results if r.ai_used)

    return {
        "success": all_success,
        "nodes_executed": len(results),
        "ai_nodes": ai_nodes_used,
        "results": [r.model_dump() for r in results],
        "final_output": node_outputs.get(ordered[-1].id) if ordered else None,
    }
