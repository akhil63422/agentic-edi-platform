"""
Script to populate the database with sample data for all tables
"""
import asyncio
from datetime import datetime, timedelta, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import random

# MongoDB connection
MONGODB_URL = "mongodb://localhost:27017"
DB_NAME = "edi_platform"

# Sample data
SAMPLE_PARTNERS = [
    {
        "business_name": "Walmart Inc.",
        "partner_code": "WMT",
        "role": "Customer",
        "industry": "Retail",
        "country": "USA",
        "timezone": "America/Chicago",
        "status": "Active",
        "business_contact": {
            "name": "John Smith",
            "email": "john.smith@walmart.com",
            "phone": "+1-555-0101"
        },
        "technical_contact": {
            "name": "Sarah Johnson",
            "email": "sarah.johnson@walmart.com",
            "phone": "+1-555-0102"
        },
        "edi_config": {
            "standard": "X12",
            "version": "5010",
            "functional_group": "PO",
            "character_set": "ASCII",
            "isa_sender_id": "WMT001",
            "isa_receiver_id": "YOURCOMPANY"
        },
        "document_agreements": [
            {
                "transaction_set": "850",
                "direction": "Inbound",
                "frequency": "Daily",
                "acknowledgment_required": True
            },
            {
                "transaction_set": "856",
                "direction": "Inbound",
                "frequency": "Daily",
                "acknowledgment_required": True
            }
        ],
        "created_at": datetime.now(timezone.utc) - timedelta(days=30),
        "updated_at": datetime.now(timezone.utc) - timedelta(days=1)
    },
    {
        "business_name": "Target Corporation",
        "partner_code": "TGT",
        "role": "Customer",
        "industry": "Retail",
        "country": "USA",
        "timezone": "America/Chicago",
        "status": "Active",
        "business_contact": {
            "name": "Mike Davis",
            "email": "mike.davis@target.com",
            "phone": "+1-555-0201"
        },
        "edi_config": {
            "standard": "X12",
            "version": "5010",
            "functional_group": "PO",
            "isa_sender_id": "TGT001",
            "isa_receiver_id": "YOURCOMPANY"
        },
        "document_agreements": [
            {
                "transaction_set": "850",
                "direction": "Inbound",
                "frequency": "Daily"
            }
        ],
        "created_at": datetime.now(timezone.utc) - timedelta(days=25),
        "updated_at": datetime.now(timezone.utc) - timedelta(hours=5)
    },
    {
        "business_name": "Amazon.com",
        "partner_code": "AMZN",
        "role": "Both",
        "industry": "E-commerce",
        "country": "USA",
        "timezone": "America/Los_Angeles",
        "status": "Active",
        "edi_config": {
            "standard": "X12",
            "version": "5010",
            "functional_group": "PO",
            "isa_sender_id": "AMZN001",
            "isa_receiver_id": "YOURCOMPANY"
        },
        "document_agreements": [
            {
                "transaction_set": "850",
                "direction": "Inbound"
            },
            {
                "transaction_set": "810",
                "direction": "Outbound"
            },
            {
                "transaction_set": "856",
                "direction": "Inbound"
            }
        ],
        "created_at": datetime.now(timezone.utc) - timedelta(days=20),
        "updated_at": datetime.now(timezone.utc) - timedelta(hours=2)
    },
    {
        "business_name": "Home Depot",
        "partner_code": "HD",
        "role": "Supplier",
        "industry": "Retail",
        "country": "USA",
        "timezone": "America/New_York",
        "status": "Testing",
        "edi_config": {
            "standard": "X12",
            "version": "4010",
            "functional_group": "PO",
            "isa_sender_id": "HD001",
            "isa_receiver_id": "YOURCOMPANY"
        },
        "document_agreements": [
            {
                "transaction_set": "850",
                "direction": "Inbound"
            }
        ],
        "created_at": datetime.now(timezone.utc) - timedelta(days=10),
        "updated_at": datetime.now(timezone.utc) - timedelta(days=3)
    },
    {
        "business_name": "Costco Wholesale",
        "partner_code": "COST",
        "role": "Customer",
        "industry": "Retail",
        "country": "USA",
        "timezone": "America/Los_Angeles",
        "status": "Draft",
        "created_at": datetime.now(timezone.utc) - timedelta(days=5),
        "updated_at": datetime.now(timezone.utc) - timedelta(days=5)
    }
]

async def populate_data():
    """Populate all collections with sample data"""
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DB_NAME]
    
    print("Starting data population...")
    
    # Clear existing data (optional - comment out if you want to keep existing data)
    # await db.trading_partners.delete_many({})
    # await db.documents.delete_many({})
    # await db.exceptions.delete_many({})
    # await db.audit_logs.delete_many({})
    
    # 1. Insert Trading Partners
    print("Inserting trading partners...")
    partner_ids = {}
    for partner_data in SAMPLE_PARTNERS:
        result = await db.trading_partners.insert_one(partner_data)
        partner_ids[partner_data["partner_code"]] = str(result.inserted_id)
        print(f"  ✓ Inserted {partner_data['business_name']} ({partner_data['partner_code']})")
    
    # 2. Insert Documents
    print("\nInserting documents...")
    document_ids = []
    statuses = ["Completed", "Processing", "Needs Review", "Failed", "Completed", "Completed"]
    doc_types = ["850", "810", "856", "850", "810", "850"]
    directions = ["Inbound", "Outbound", "Inbound", "Inbound", "Outbound", "Inbound"]
    
    for i in range(50):
        partner_code = random.choice(list(partner_ids.keys()))
        partner_id = partner_ids[partner_code]
        status = random.choice(statuses)
        doc_type = random.choice(doc_types)
        direction = random.choice(directions)
        
        # Create timestamps
        days_ago = random.randint(0, 7)
        received_at = datetime.now(timezone.utc) - timedelta(days=days_ago, hours=random.randint(0, 23))
        processed_at = received_at + timedelta(minutes=random.randint(1, 30)) if status == "Completed" else None
        
        doc = {
            "partner_id": partner_id,
            "partner_code": partner_code,
            "document_type": f"X12 {doc_type}",
            "direction": direction,
            "status": status,
            "raw_edi": f"ISA*00*          *00*          *ZZ*{partner_code}           *ZZ*YOURCOMPANY    *{received_at.strftime('%y%m%d')}*{received_at.strftime('%H%M')}*^*00501*000000001*0*P*:~GS*PO*{partner_code}*YOURCOMPANY*{received_at.strftime('%Y%m%d')}*{received_at.strftime('%H%M%S')}*1*X*005010~ST*{doc_type}*0001~",
            "file_name": f"{doc_type}_{partner_code}_{i+1:04d}.edi",
            "file_size": random.randint(5000, 50000),
            "ai_confidence_score": round(random.uniform(0.75, 0.98), 2) if status != "Failed" else round(random.uniform(0.3, 0.6), 2),
            "received_at": received_at,
            "processed_at": processed_at,
            "created_at": received_at,
            "updated_at": processed_at or received_at,
            "erp_posted": status == "Completed",
            "acknowledgment_sent": status == "Completed"
        }
        
        result = await db.documents.insert_one(doc)
        document_ids.append(str(result.inserted_id))
        
        if (i + 1) % 10 == 0:
            print(f"  ✓ Inserted {i + 1} documents...")
    
    print(f"  ✓ Total: {len(document_ids)} documents inserted")
    
    # 3. Insert Exceptions
    print("\nInserting exceptions...")
    exception_types = ["Low Confidence", "Validation Error", "Mapping Error", "Business Rule Violation", "Data Quality"]
    severities = ["Critical", "High", "Medium", "Low"]
    exception_statuses = ["Open", "Open", "In Review", "Resolved", "Open"]
    
    for i in range(25):
        doc_id = random.choice(document_ids)
        # Find partner for this document
        doc = await db.documents.find_one({"_id": ObjectId(doc_id)})
        partner_id = doc["partner_id"]
        partner_code = doc["partner_code"]
        
        exception_type = random.choice(exception_types)
        severity = random.choice(severities)
        status = random.choice(exception_statuses)
        
        created_at = datetime.now(timezone.utc) - timedelta(days=random.randint(0, 5), hours=random.randint(0, 23))
        resolved_at = created_at + timedelta(hours=random.randint(1, 48)) if status == "Resolved" else None
        
        exception = {
            "document_id": doc_id,
            "partner_id": partner_id,
            "partner_code": partner_code,
            "exception_type": exception_type,
            "severity": severity,
            "status": status,
            "ai_confidence_score": round(random.uniform(0.4, 0.7), 2),
            "ai_suggestion": f"Review field mapping for {exception_type.lower()}",
            "description": f"{exception_type} detected in document {doc_id[:8]}",
            "field_path": f"segment_{random.randint(1, 10)}.field_{random.randint(1, 5)}",
            "resolved_by": "admin@company.com" if status == "Resolved" else None,
            "resolved_at": resolved_at,
            "created_at": created_at,
            "updated_at": resolved_at or created_at,
            "tags": [exception_type.lower().replace(" ", "_"), severity.lower()]
        }
        
        await db.exceptions.insert_one(exception)
    
    print(f"  ✓ Inserted 25 exceptions")
    
    # 4. Insert Audit Logs
    print("\nInserting audit logs...")
    action_types = ["Processing", "Exception", "Configuration", "Transport", "Security", "AI"]
    actions = ["Created", "Updated", "Processed", "Deleted", "Approved", "Rejected"]
    entity_types = ["Partner", "Document", "Mapping", "Exception", "User"]
    user_types = ["Human", "AI Agent", "Human", "Human"]
    
    for i in range(100):
        action_type = random.choice(action_types)
        action = random.choice(actions)
        entity_type = random.choice(entity_types)
        user_type = random.choice(user_types)
        
        # Assign entity_id based on entity_type
        entity_id = None
        if entity_type == "Partner":
            entity_id = random.choice(list(partner_ids.values()))
        elif entity_type == "Document":
            entity_id = random.choice(document_ids)
        elif entity_type == "Exception":
            # Get a random exception ID
            exc = await db.exceptions.find_one({})
            if exc:
                entity_id = str(exc["_id"])
        
        created_at = datetime.now(timezone.utc) - timedelta(days=random.randint(0, 7), hours=random.randint(0, 23))
        
        audit_log = {
            "action_type": action_type,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "user_id": "admin@company.com" if user_type == "Human" else "ai-agent-001",
            "user_type": user_type,
            "description": f"{action} {entity_type.lower()} {entity_id[:8] if entity_id else 'N/A'}",
            "ip_address": f"192.168.1.{random.randint(1, 255)}",
            "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
            "created_at": created_at,
            "metadata": {
                "source": "web_ui" if user_type == "Human" else "automated",
                "session_id": f"session_{random.randint(1000, 9999)}"
            }
        }
        
        await db.audit_logs.insert_one(audit_log)
    
    print(f"  ✓ Inserted 100 audit logs")
    
    print("\n✅ Data population completed successfully!")
    print(f"\nSummary:")
    print(f"  - Trading Partners: {len(SAMPLE_PARTNERS)}")
    print(f"  - Documents: {len(document_ids)}")
    print(f"  - Exceptions: 25")
    print(f"  - Audit Logs: 100")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(populate_data())
