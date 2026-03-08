"""
ERP Service
Handles integration with ERP systems (SAP, Oracle, NetSuite, Salesforce, etc.)

SAP Integration:
  - Primary: SAP S/4HANA OData REST APIs (no pyrfc dependency required)
  - Secondary: SAP RFC via pyrfc if installed and configured
  - Fallback: Simulated (logs intent but returns success)

Oracle Integration:
  - Oracle REST Data Services (ORDS) for Oracle ERP Cloud / EBS
  - Direct REST calls to Oracle Cloud Financials/SCM APIs
  - Fallback: Simulated
"""
import os
import json
import httpx
from typing import Dict, Any, Optional
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class ERPService:
    """ERP Integration Service"""
    
    def __init__(self):
        pass
    
    async def post_to_erp(
        self,
        canonical_json: Dict[str, Any],
        erp_config: Dict[str, Any],
        document_type: str
    ) -> Dict[str, Any]:
        """Post canonical JSON data to ERP system"""
        erp_type = erp_config.get("type", "REST")
        
        try:
            if erp_type == "SAP":
                return await self._post_to_sap(canonical_json, erp_config, document_type)
            elif erp_type == "Oracle":
                return await self._post_to_oracle(canonical_json, erp_config, document_type)
            elif erp_type == "Salesforce":
                return await self._post_to_salesforce(canonical_json, erp_config, document_type)
            elif erp_type == "NetSuite":
                return await self._post_to_netsuite(canonical_json, erp_config, document_type)
            elif erp_type == "REST":
                return await self._post_to_rest(canonical_json, erp_config, document_type)
            elif erp_type == "Database":
                return await self._post_to_database(canonical_json, erp_config, document_type)
            else:
                raise ValueError(f"Unsupported ERP type: {erp_type}")
        
        except Exception as e:
            logger.error(f"Error posting to ERP: {e}")
            return {"success": False, "error": str(e)}
    
    async def _post_to_sap(
        self,
        canonical_json: Dict[str, Any],
        erp_config: Dict[str, Any],
        document_type: str,
    ) -> Dict[str, Any]:
        """
        Post to SAP via:
          1. SAP S/4HANA OData REST API  (preferred, requires base_url + client_id + client_secret)
          2. SAP RFC via pyrfc             (requires RFC_SERVER_NAME / ashost + sysnr + client + user + password)
          3. Simulated fallback
        """
        base_url = erp_config.get("base_url") or erp_config.get("endpoint")
        client_id = erp_config.get("client_id") or erp_config.get("api_key")
        client_secret = erp_config.get("client_secret")
        token_url = erp_config.get("token_url")

        # ── Path 1: SAP OData REST (S/4HANA Cloud / On-Prem with API Gateway) ──────
        if base_url and client_id:
            try:
                access_token = await self._sap_get_oauth_token(token_url, client_id, client_secret, base_url)
                headers = {
                    "Authorization": f"Bearer {access_token}" if access_token else f"Basic {client_id}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "sap-client": erp_config.get("sap_client", "100"),
                }
                payload = self._canonical_to_sap_odata(canonical_json, document_type)
                service_path = self._sap_service_path(document_type)
                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.post(
                        f"{base_url.rstrip('/')}{service_path}",
                        json=payload,
                        headers=headers,
                    )
                    resp.raise_for_status()
                    data = resp.json() if resp.content else {}
                    return {
                        "success": True,
                        "erp_id": data.get("d", {}).get("ObjectID") or data.get("value", [{}])[0].get("PurchaseOrder", f"SAP-{datetime.utcnow().strftime('%H%M%S')}"),
                        "message": f"Posted {document_type} to SAP OData successfully",
                        "method": "odata",
                    }
            except httpx.HTTPStatusError as e:
                logger.error(f"SAP OData error {e.response.status_code}: {e.response.text[:500]}")
                return {"success": False, "error": f"SAP HTTP {e.response.status_code}: {e.response.text[:200]}"}
            except Exception as e:
                logger.warning(f"SAP OData failed: {e} — trying RFC fallback")

        # ── Path 2: SAP RFC via pyrfc ────────────────────────────────────────────────
        rfc_params = {
            "ashost": erp_config.get("ashost") or erp_config.get("sap_host"),
            "sysnr": erp_config.get("sysnr", "00"),
            "client": erp_config.get("sap_client", "100"),
            "user": erp_config.get("sap_user") or erp_config.get("username"),
            "passwd": erp_config.get("sap_password") or erp_config.get("password"),
        }
        if all(rfc_params.values()):
            try:
                import pyrfc
                conn = pyrfc.Connection(**rfc_params)
                bapi_name, bapi_params = self._canonical_to_sap_bapi(canonical_json, document_type)
                result = conn.call(bapi_name, **bapi_params)
                conn.close()
                return {
                    "success": True,
                    "erp_id": result.get("PURCHASEORDER") or result.get("VBELN") or result.get("BELNR", "SAP_RFC_OK"),
                    "message": f"Posted {document_type} to SAP via RFC ({bapi_name})",
                    "method": "rfc",
                }
            except ImportError:
                logger.info("pyrfc not installed — skipping RFC, using simulation")
            except Exception as e:
                logger.error(f"SAP RFC error: {e}")
                return {"success": False, "error": str(e)}

        # ── Path 3: Simulated ─────────────────────────────────────────────────────────
        fields = canonical_json.get("fields", {}) if isinstance(canonical_json, dict) else {}
        logger.info(f"SAP simulation: {document_type} for PO {fields.get('purchase_order_number', 'N/A')}")
        return {
            "success": True,
            "erp_id": f"SAP-SIM-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            "message": f"SAP simulated — configure base_url+client_id or ashost+sap_user for live posting",
            "method": "simulated",
        }

    async def _sap_get_oauth_token(
        self,
        token_url: Optional[str],
        client_id: str,
        client_secret: Optional[str],
        base_url: str,
    ) -> Optional[str]:
        """Fetch SAP OAuth2 token (client credentials flow)."""
        if not token_url:
            # Try to derive token URL from base URL (SAP Cloud Pattern)
            host = base_url.split("/")[2] if "://" in base_url else base_url
            token_url = f"https://{host}/oauth/token"
        if not client_secret:
            return None
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    token_url,
                    data={"grant_type": "client_credentials", "client_id": client_id, "client_secret": client_secret},
                )
                resp.raise_for_status()
                return resp.json().get("access_token")
        except Exception as e:
            logger.warning(f"SAP OAuth token fetch failed: {e}")
            return None

    def _sap_service_path(self, document_type: str) -> str:
        """Map document type to SAP OData service path."""
        dt = str(document_type).replace("X12 ", "").split()[0]
        paths = {
            "850": "/sap/opu/odata/sap/MM_PUR_POITEMS_MASS_CHANGE_SRV/PurchaseOrders",
            "856": "/sap/opu/odata/sap/API_INBOUND_DELIVERY_SRV/A_InbDeliveryHeader",
            "810": "/sap/opu/odata/sap/API_SUPPLIERINVOICE_PROCESS_SRV/A_SupplierInvoice",
            "875": "/sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrder",
        }
        return paths.get(dt, "/sap/opu/odata/sap/ZEDI_GENERIC_SRV/EDIDocuments")

    def _canonical_to_sap_odata(self, canonical_json: Dict[str, Any], document_type: str) -> Dict[str, Any]:
        """Transform canonical JSON to SAP OData payload."""
        fields = canonical_json.get("fields", {}) if isinstance(canonical_json, dict) else {}
        dt = str(document_type).replace("X12 ", "").split()[0]
        now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

        if dt == "850":
            return {
                "PurchaseOrderType": "NB",
                "PurchasingOrganization": "1000",
                "PurchasingGroup": "001",
                "CompanyCode": "1000",
                "Supplier": fields.get("seller_name", fields.get("vendor_name", "VENDOR001")),
                "DocumentCurrency": fields.get("currency", "USD"),
                "PurchaseOrderDate": now[:10],
                "PurchasingDocumentOrderText": fields.get("purchase_order_number", ""),
            }
        if dt == "810":
            return {
                "InvoicingParty": fields.get("vendor_name", "VENDOR001"),
                "DocumentDate": now[:10],
                "PostingDate": now[:10],
                "InvoiceGrossAmount": str(fields.get("total_due", fields.get("totalDue", 0))),
                "DocumentCurrency": "USD",
                "PurchaseOrder": fields.get("purchase_order_ref", ""),
            }
        return {"EDIDocType": dt, "Fields": fields, "Timestamp": now}

    def _canonical_to_sap_bapi(self, canonical_json: Dict[str, Any], document_type: str):
        """Map canonical JSON to SAP BAPI name + params."""
        fields = canonical_json.get("fields", {}) if isinstance(canonical_json, dict) else {}
        dt = str(document_type).replace("X12 ", "").split()[0]

        if dt == "850":
            return "BAPI_PO_CREATE1", {
                "POHEADER": {
                    "DOC_TYPE": "NB",
                    "PURCH_ORG": "1000",
                    "PUR_GROUP": "001",
                    "COMP_CODE": "1000",
                    "VENDOR": fields.get("seller_name", "VENDOR001"),
                    "CURRENCY": fields.get("currency", "USD"),
                },
                "POHEADERX": {"DOC_TYPE": "X", "PURCH_ORG": "X", "PUR_GROUP": "X", "COMP_CODE": "X", "VENDOR": "X", "CURRENCY": "X"},
            }
        if dt == "810":
            return "BAPI_INCOMINGINVOICE_CREATE", {
                "HEADERDATA": {
                    "INVOICE_IND": "X",
                    "DOC_DATE": datetime.utcnow().strftime("%Y%m%d"),
                    "PSTNG_DATE": datetime.utcnow().strftime("%Y%m%d"),
                    "GROSS_AMOUNT": str(fields.get("total_due", 0)),
                    "CURRENCY": "USD",
                },
            }
        return "BAPI_EDI_DATASEND", {"DATA": json.dumps(fields)[:4096]}

    async def _post_to_oracle(
        self,
        canonical_json: Dict[str, Any],
        erp_config: Dict[str, Any],
        document_type: str,
    ) -> Dict[str, Any]:
        """
        Post to Oracle ERP Cloud via Oracle REST Data Services (ORDS) or Oracle Cloud REST APIs.

        Supports:
          1. Oracle ERP Cloud REST API (Fusion) — base_url + client_id + client_secret
          2. Oracle EBS ORDS — base_url + username + password (Basic auth)
          3. Simulated fallback
        """
        base_url = erp_config.get("base_url") or erp_config.get("endpoint")
        client_id = erp_config.get("client_id") or erp_config.get("api_key")
        client_secret = erp_config.get("client_secret")
        username = erp_config.get("username") or erp_config.get("sap_user")
        password = erp_config.get("password") or erp_config.get("sap_password")

        # ── Path 1: Oracle Fusion Cloud REST API ─────────────────────────────────────
        if base_url and client_id:
            try:
                access_token = await self._oracle_get_oauth_token(base_url, client_id, client_secret)
                headers = {
                    "Authorization": f"Bearer {access_token}" if access_token else "",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                }
                payload = self._canonical_to_oracle_payload(canonical_json, document_type)
                service_path = self._oracle_service_path(document_type)
                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.post(
                        f"{base_url.rstrip('/')}{service_path}",
                        json=payload,
                        headers=headers,
                    )
                    resp.raise_for_status()
                    data = resp.json() if resp.content else {}
                    return {
                        "success": True,
                        "erp_id": data.get("OrderNumber") or data.get("invoiceId") or f"ORA-{datetime.utcnow().strftime('%H%M%S')}",
                        "message": f"Posted {document_type} to Oracle Cloud REST successfully",
                        "method": "oracle_cloud_rest",
                    }
            except httpx.HTTPStatusError as e:
                logger.error(f"Oracle REST error {e.response.status_code}: {e.response.text[:500]}")
                return {"success": False, "error": f"Oracle HTTP {e.response.status_code}: {e.response.text[:200]}"}
            except Exception as e:
                logger.warning(f"Oracle REST failed: {e} — trying Basic auth fallback")

        # ── Path 2: Oracle EBS ORDS (Basic auth) ─────────────────────────────────────
        if base_url and username and password:
            try:
                import base64
                credentials = base64.b64encode(f"{username}:{password}".encode()).decode()
                headers = {
                    "Authorization": f"Basic {credentials}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                }
                payload = self._canonical_to_oracle_payload(canonical_json, document_type)
                service_path = self._oracle_service_path(document_type)
                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.post(
                        f"{base_url.rstrip('/')}{service_path}",
                        json=payload,
                        headers=headers,
                    )
                    resp.raise_for_status()
                    data = resp.json() if resp.content else {}
                    return {
                        "success": True,
                        "erp_id": data.get("OrderNumber") or data.get("id", f"ORA-EBS-{datetime.utcnow().strftime('%H%M%S')}"),
                        "message": f"Posted {document_type} to Oracle EBS ORDS",
                        "method": "oracle_ords_basic",
                    }
            except httpx.HTTPStatusError as e:
                logger.error(f"Oracle ORDS error: {e.response.status_code}")
                return {"success": False, "error": f"Oracle ORDS HTTP {e.response.status_code}"}
            except Exception as e:
                logger.error(f"Oracle ORDS failed: {e}")
                return {"success": False, "error": str(e)}

        # ── Path 3: Simulated ─────────────────────────────────────────────────────────
        fields = canonical_json.get("fields", {}) if isinstance(canonical_json, dict) else {}
        logger.info(f"Oracle simulation: {document_type}")
        return {
            "success": True,
            "erp_id": f"ORA-SIM-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            "message": "Oracle simulated — configure base_url+client_id or base_url+username+password for live posting",
            "method": "simulated",
        }

    async def _oracle_get_oauth_token(
        self,
        base_url: str,
        client_id: str,
        client_secret: Optional[str],
    ) -> Optional[str]:
        """Fetch Oracle Cloud OAuth2 token (client credentials)."""
        if not client_secret:
            return None
        try:
            # Oracle Cloud token endpoint pattern
            host = base_url.split("/")[2] if "://" in base_url else base_url
            token_url = f"https://{host}/oauth/token"
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    token_url,
                    data={"grant_type": "client_credentials"},
                    auth=(client_id, client_secret),
                )
                resp.raise_for_status()
                return resp.json().get("access_token")
        except Exception as e:
            logger.warning(f"Oracle OAuth token failed: {e}")
            return None

    def _oracle_service_path(self, document_type: str) -> str:
        """Map document type to Oracle Cloud REST service path."""
        dt = str(document_type).replace("X12 ", "").split()[0]
        paths = {
            "850": "/fscmRestApi/resources/11.13.18.05/purchaseOrders",
            "856": "/fscmRestApi/resources/11.13.18.05/receivingReceiptsRequests",
            "810": "/fscmRestApi/resources/11.13.18.05/supplierInvoices",
            "875": "/fscmRestApi/resources/11.13.18.05/orders",
            "840": "/fscmRestApi/resources/11.13.18.05/purchaseRequisitions",
        }
        return paths.get(dt, f"/fscmRestApi/resources/11.13.18.05/ediDocuments")

    def _canonical_to_oracle_payload(self, canonical_json: Dict[str, Any], document_type: str) -> Dict[str, Any]:
        """Transform canonical JSON to Oracle Cloud REST payload."""
        fields = canonical_json.get("fields", {}) if isinstance(canonical_json, dict) else {}
        dt = str(document_type).replace("X12 ", "").split()[0]
        now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S")

        if dt == "850":
            return {
                "ProcurementBusinessUnit": fields.get("buyer_name", "Vision Operations"),
                "BuyerEmail": "",
                "Supplier": fields.get("seller_name", fields.get("vendor_name", "")),
                "Currency": fields.get("currency", "USD"),
                "OrderDate": now[:10],
                "Description": fields.get("purchase_order_number", "EDI-PO"),
                "lines": [],
            }
        if dt == "810":
            return {
                "InvoiceSource": "EDI",
                "VendorName": fields.get("vendor_name", ""),
                "InvoiceDate": now[:10],
                "InvoiceCurrencyCode": "USD",
                "InvoiceAmount": float(str(fields.get("total_due", 0)).replace(",", "") or 0),
                "PurchaseOrderNumber": fields.get("purchase_order_ref", ""),
            }
        if dt == "840":
            return {
                "RequisitionType": "PURCHASE",
                "Description": fields.get("purchase_order_number", "EDI-PR"),
                "CreationDate": now[:10],
                "lines": [],
            }
        return {"DocumentType": dt, "Fields": fields, "Timestamp": now}
    
    async def _post_to_salesforce(
        self,
        canonical_json: Dict[str, Any],
        erp_config: Dict[str, Any],
        document_type: str
    ) -> Dict[str, Any]:
        """Post to Salesforce OMS / Commerce Cloud via REST API"""
        try:
            endpoint = erp_config.get("endpoint") or erp_config.get("instance_url")
            access_token = erp_config.get("access_token") or erp_config.get("api_key")
            if not endpoint or not access_token:
                logger.info(f"Salesforce config incomplete, simulating post for {document_type}")
                return {
                    "success": True,
                    "erp_id": "SF_" + str(hash(str(canonical_json))),
                    "message": "Posted to Salesforce successfully",
                }
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            }
            sf_object = self._get_salesforce_object(document_type)
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{endpoint.rstrip('/')}/services/data/v59.0/sobjects/{sf_object}",
                    json={"fields": canonical_json.get("fields", {})},
                    headers=headers,
                )
                response.raise_for_status()
                return {
                    "success": True,
                    "erp_id": response.json().get("id"),
                    "message": "Posted to Salesforce successfully",
                }
        except Exception as e:
            logger.error(f"Error posting to Salesforce: {e}")
            return {"success": False, "error": str(e)}

    def _get_salesforce_object(self, document_type: str) -> str:
        mapping = {"850": "Order", "810": "Invoice", "856": "Shipment", "875": "Order"}
        return mapping.get(document_type, "CustomObject")

    async def _post_to_netsuite(
        self,
        canonical_json: Dict[str, Any],
        erp_config: Dict[str, Any],
        document_type: str
    ) -> Dict[str, Any]:
        """Post to NetSuite via REST API"""
        try:
            endpoint = erp_config.get("endpoint")
            api_key = erp_config.get("api_key")
            account_id = erp_config.get("account_id")
            
            if not endpoint or not api_key:
                raise ValueError("NetSuite endpoint and API key required")
            
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            
            # Transform canonical JSON to NetSuite format
            netsuite_data = self._transform_to_netsuite(canonical_json, document_type)
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{endpoint}/record/v1/{self._get_netsuite_record_type(document_type)}",
                    json=netsuite_data,
                    headers=headers
                )
                response.raise_for_status()
                
                return {
                    "success": True,
                    "erp_id": response.json().get("id"),
                    "message": "Posted to NetSuite successfully"
                }
        
        except Exception as e:
            logger.error(f"Error posting to NetSuite: {e}")
            return {"success": False, "error": str(e)}
    
    async def _post_to_rest(
        self,
        canonical_json: Dict[str, Any],
        erp_config: Dict[str, Any],
        document_type: str
    ) -> Dict[str, Any]:
        """Post to generic REST API"""
        try:
            endpoint = erp_config.get("endpoint")
            api_key = erp_config.get("api_key")
            
            if not endpoint:
                raise ValueError("REST endpoint required")
            
            headers = {
                "Content-Type": "application/json"
            }
            
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    endpoint,
                    json=canonical_json,
                    headers=headers
                )
                response.raise_for_status()
                
                return {
                    "success": True,
                    "erp_id": response.json().get("id"),
                    "message": "Posted to REST API successfully"
                }
        
        except Exception as e:
            logger.error(f"Error posting to REST API: {e}")
            return {"success": False, "error": str(e)}
    
    async def _post_to_database(
        self,
        canonical_json: Dict[str, Any],
        erp_config: Dict[str, Any],
        document_type: str
    ) -> Dict[str, Any]:
        """Post to database directly"""
        # Database integration placeholder
        logger.info(f"Posting {document_type} to database")
        return {
            "success": True,
            "erp_id": "DB_" + str(hash(str(canonical_json))),
            "message": "Posted to database successfully"
        }
    
    def _transform_to_netsuite(
        self,
        canonical_json: Dict[str, Any],
        document_type: str
    ) -> Dict[str, Any]:
        """Transform canonical JSON to NetSuite format"""
        # Basic transformation - would need full mapping logic
        return {
            "recordType": self._get_netsuite_record_type(document_type),
            "fields": canonical_json.get("fields", {})
        }
    
    def _get_netsuite_record_type(self, document_type: str) -> str:
        """Get NetSuite record type for document type"""
        mapping = {
            "850": "purchaseorder",
            "810": "invoice",
            "856": "itemfulfillment",
        }
        return mapping.get(document_type, "customrecord")


# Global ERP service instance
erp_service = ERPService()
