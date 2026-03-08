#!/bin/bash
# Show MongoDB data stored in Docker (edi-mongo) - for manager demo
# Run: ./scripts/show-mongodb-data.sh
# Or save to file: ./scripts/show-mongodb-data.sh > mongodb_data_report.txt

echo "=============================================="
echo "  EDI PLATFORM - MONGODB DATA (Docker)"
echo "  Container: edi-mongo | DB: edi_platform"
echo "=============================================="
echo ""

docker exec edi-mongo mongosh edi_platform --quiet --eval "
print('COLLECTIONS:');
db.getCollectionNames().forEach(c => print('  • ' + c));
print('');
print('RECORD COUNTS:');
print('  documents (EDI files):     ' + db.documents.countDocuments());
print('  trading_partners:          ' + db.trading_partners.countDocuments());
print('  mappings:                  ' + db.mappings.countDocuments());
print('  exceptions:                ' + db.exceptions.countDocuments());
print('  audit_logs:                ' + db.audit_logs.countDocuments());
print('');
print('SAMPLE EDI DOCUMENTS (Inbound):');
print('  File Name                          | Type           | Status     | Received');
print('  ' + '-'.repeat(75));
db.documents.find({direction: 'Inbound'}, {file_name: 1, document_type: 1, status: 1, received_at: 1}).limit(15).forEach(d => {
  var fn = (d.file_name || 'N/A').padEnd(35);
  var dt = (d.document_type || 'N/A').padEnd(14);
  var st = (d.status || 'N/A').padEnd(10);
  var rd = (d.received_at ? d.received_at.toISOString().slice(0,19) : 'N/A');
  print('  ' + fn + ' | ' + dt + ' | ' + st + ' | ' + rd);
});
print('');
print('SAMPLE RAW EDI CONTENT (first document):');
var doc = db.documents.findOne({direction: 'Inbound', raw_edi: {\$ne: ''}}, {file_name: 1, raw_edi: 1});
if (doc && doc.raw_edi) {
  print('  File: ' + doc.file_name);
  print('  ' + '-'.repeat(60));
  var lines = doc.raw_edi.split('~').slice(0, 8);
  lines.forEach(l => { if (l.trim()) print('  ' + l.trim()); });
  print('  ...');
}
"

echo ""
echo "=============================================="
echo "  To view in MongoDB Compass:"
echo "  Connect to: mongodb://localhost:27017"
echo "  Database: edi_platform"
echo "=============================================="
