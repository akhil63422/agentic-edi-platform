"""
EDI Parser Service
Handles parsing of X12 and EDIFACT documents
"""
import re
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class EDIParser:
    """Base EDI Parser"""
    
    def __init__(self):
        self.errors = []
        self.warnings = []
    
    def parse(self, raw_edi: str) -> Dict[str, Any]:
        """Parse EDI document"""
        raise NotImplementedError
    
    def validate(self, parsed_data: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """Validate parsed EDI document"""
        raise NotImplementedError


class X12Parser(EDIParser):
    """X12 EDI Parser"""
    
    def __init__(self):
        super().__init__()
        self.segment_delimiter = "~"
        self.element_delimiter = "*"
        self.sub_element_delimiter = ":"
    
    def parse(self, raw_edi: str) -> Dict[str, Any]:
        """Parse X12 document"""
        try:
            self.errors = []
            self.warnings = []
            
            # Extract delimiters from ISA segment
            if not raw_edi.startswith("ISA"):
                raise ValueError("Invalid X12 document: Must start with ISA segment")
            
            # Parse ISA segment (first 106 characters)
            isa_segment = raw_edi[:106]
            if len(isa_segment) < 106:
                raise ValueError("Invalid ISA segment length")
            
            # Extract delimiters from ISA
            self.element_delimiter = isa_segment[3]
            self.sub_element_delimiter = isa_segment[104] if len(isa_segment) > 104 else ":"
            
            # Split into segments
            segments = raw_edi.split(self.segment_delimiter)
            segments = [s.strip() for s in segments if s.strip()]
            
            parsed_segments = []
            current_functional_group = None
            current_transaction = None
            
            for segment in segments:
                if not segment:
                    continue
                
                segment_id = segment[:3]
                elements = segment.split(self.element_delimiter)
                
                segment_data = {
                    "segment_id": segment_id,
                    "elements": elements[1:],  # Skip segment ID
                    "raw": segment
                }
                
                # Parse ISA
                if segment_id == "ISA":
                    segment_data["data"] = self._parse_isa(elements)
                
                # Parse GS (Functional Group Header)
                elif segment_id == "GS":
                    segment_data["data"] = self._parse_gs(elements)
                    current_functional_group = segment_data["data"]
                
                # Parse ST (Transaction Set Header)
                elif segment_id == "ST":
                    segment_data["data"] = self._parse_st(elements)
                    current_transaction = segment_data["data"]
                
                # Parse SE (Transaction Set Trailer)
                elif segment_id == "SE":
                    segment_data["data"] = self._parse_se(elements)
                
                # Parse GE (Functional Group Trailer)
                elif segment_id == "GE":
                    segment_data["data"] = self._parse_ge(elements)
                
                # Parse IEA (Interchange Trailer)
                elif segment_id == "IEA":
                    segment_data["data"] = self._parse_iea(elements)
                
                # Common segments
                elif segment_id == "BEG":
                    segment_data["data"] = self._parse_beg(elements)
                elif segment_id == "N1":
                    segment_data["data"] = self._parse_n1(elements)
                elif segment_id == "N2":
                    segment_data["data"] = self._parse_n2(elements)
                elif segment_id == "N3":
                    segment_data["data"] = self._parse_n3(elements)
                elif segment_id == "N4":
                    segment_data["data"] = self._parse_n4(elements)
                elif segment_id == "IT1":
                    segment_data["data"] = self._parse_it1(elements)
                elif segment_id == "TDS":
                    segment_data["data"] = self._parse_tds(elements)
                
                parsed_segments.append(segment_data)
            
            return {
                "standard": "X12",
                "segments": parsed_segments,
                "delimiters": {
                    "segment": self.segment_delimiter,
                    "element": self.element_delimiter,
                    "sub_element": self.sub_element_delimiter
                },
                "errors": self.errors,
                "warnings": self.warnings
            }
        
        except Exception as e:
            logger.error(f"Error parsing X12 document: {e}")
            self.errors.append(str(e))
            raise
    
    def _parse_isa(self, elements: List[str]) -> Dict[str, Any]:
        """Parse ISA segment"""
        if len(elements) < 17:
            raise ValueError("ISA segment must have at least 17 elements")
        
        return {
            "authorization_qualifier": elements[1] if len(elements) > 1 else "",
            "authorization_info": elements[2] if len(elements) > 2 else "",
            "security_qualifier": elements[3] if len(elements) > 3 else "",
            "security_info": elements[4] if len(elements) > 4 else "",
            "interchange_id_qualifier": elements[5] if len(elements) > 5 else "",
            "interchange_sender_id": elements[6] if len(elements) > 6 else "",
            "interchange_id_qualifier_2": elements[7] if len(elements) > 7 else "",
            "interchange_receiver_id": elements[8] if len(elements) > 8 else "",
            "interchange_date": elements[9] if len(elements) > 9 else "",
            "interchange_time": elements[10] if len(elements) > 10 else "",
            "interchange_control_standards_id": elements[11] if len(elements) > 11 else "",
            "interchange_control_version_number": elements[12] if len(elements) > 12 else "",
            "interchange_control_number": elements[13] if len(elements) > 13 else "",
            "acknowledgment_requested": elements[14] if len(elements) > 14 else "",
            "usage_indicator": elements[15] if len(elements) > 15 else "",
            "component_element_separator": elements[16] if len(elements) > 16 else "",
        }
    
    def _parse_gs(self, elements: List[str]) -> Dict[str, Any]:
        """Parse GS segment"""
        return {
            "functional_id_code": elements[1] if len(elements) > 1 else "",
            "application_sender_code": elements[2] if len(elements) > 2 else "",
            "application_receiver_code": elements[3] if len(elements) > 3 else "",
            "date": elements[4] if len(elements) > 4 else "",
            "time": elements[5] if len(elements) > 5 else "",
            "group_control_number": elements[6] if len(elements) > 6 else "",
            "responsible_agency_code": elements[7] if len(elements) > 7 else "",
            "version_release_id": elements[8] if len(elements) > 8 else "",
        }
    
    def _parse_st(self, elements: List[str]) -> Dict[str, Any]:
        """Parse ST segment"""
        return {
            "transaction_set_id": elements[1] if len(elements) > 1 else "",
            "transaction_set_control_number": elements[2] if len(elements) > 2 else "",
        }
    
    def _parse_se(self, elements: List[str]) -> Dict[str, Any]:
        """Parse SE segment"""
        return {
            "number_of_included_segments": elements[1] if len(elements) > 1 else "",
            "transaction_set_control_number": elements[2] if len(elements) > 2 else "",
        }
    
    def _parse_ge(self, elements: List[str]) -> Dict[str, Any]:
        """Parse GE segment"""
        return {
            "number_of_transaction_sets": elements[1] if len(elements) > 1 else "",
            "group_control_number": elements[2] if len(elements) > 2 else "",
        }
    
    def _parse_iea(self, elements: List[str]) -> Dict[str, Any]:
        """Parse IEA segment"""
        return {
            "number_of_functional_groups": elements[1] if len(elements) > 1 else "",
            "interchange_control_number": elements[2] if len(elements) > 2 else "",
        }
    
    def _parse_beg(self, elements: List[str]) -> Dict[str, Any]:
        """Parse BEG segment (Beginning Segment for Purchase Order)"""
        return {
            "transaction_set_purpose_code": elements[1] if len(elements) > 1 else "",
            "purchase_order_type_code": elements[2] if len(elements) > 2 else "",
            "purchase_order_number": elements[3] if len(elements) > 3 else "",
            "release_number": elements[4] if len(elements) > 4 else "",
            "date": elements[5] if len(elements) > 5 else "",
        }
    
    def _parse_n1(self, elements: List[str]) -> Dict[str, Any]:
        """Parse N1 segment (Name)"""
        return {
            "entity_identifier_code": elements[1] if len(elements) > 1 else "",
            "name": elements[2] if len(elements) > 2 else "",
            "identification_code_qualifier": elements[3] if len(elements) > 3 else "",
            "identification_code": elements[4] if len(elements) > 4 else "",
        }
    
    def _parse_n2(self, elements: List[str]) -> Dict[str, Any]:
        """Parse N2 segment (Additional Name Information)"""
        return {
            "name": elements[1] if len(elements) > 1 else "",
            "name_2": elements[2] if len(elements) > 2 else "",
        }
    
    def _parse_n3(self, elements: List[str]) -> Dict[str, Any]:
        """Parse N3 segment (Address Information)"""
        return {
            "address_information": elements[1] if len(elements) > 1 else "",
            "address_information_2": elements[2] if len(elements) > 2 else "",
        }
    
    def _parse_n4(self, elements: List[str]) -> Dict[str, Any]:
        """Parse N4 segment (Geographic Location)"""
        return {
            "city_name": elements[1] if len(elements) > 1 else "",
            "state_or_province_code": elements[2] if len(elements) > 2 else "",
            "postal_code": elements[3] if len(elements) > 3 else "",
            "country_code": elements[4] if len(elements) > 4 else "",
        }
    
    def _parse_it1(self, elements: List[str]) -> Dict[str, Any]:
        """Parse IT1 segment (Baseline Item Data)"""
        return {
            "assigned_identification": elements[1] if len(elements) > 1 else "",
            "quantity_invoiced": elements[2] if len(elements) > 2 else "",
            "unit_or_basis_for_measurement_code": elements[3] if len(elements) > 3 else "",
            "unit_price": elements[4] if len(elements) > 4 else "",
            "product_service_id_qualifier": elements[6] if len(elements) > 6 else "",
            "product_service_id": elements[7] if len(elements) > 7 else "",
        }
    
    def _parse_tds(self, elements: List[str]) -> Dict[str, Any]:
        """Parse TDS segment (Total Monetary Value Summary)"""
        return {
            "amount": elements[1] if len(elements) > 1 else "",
        }
    
    def validate(self, parsed_data: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """Validate parsed X12 document"""
        errors = []
        
        # Check for ISA segment
        isa_segments = [s for s in parsed_data.get("segments", []) if s.get("segment_id") == "ISA"]
        if not isa_segments:
            errors.append("Missing ISA segment")
        
        # Check for IEA segment
        iea_segments = [s for s in parsed_data.get("segments", []) if s.get("segment_id") == "IEA"]
        if not iea_segments:
            errors.append("Missing IEA segment")
        
        # Check for GS segment
        gs_segments = [s for s in parsed_data.get("segments", []) if s.get("segment_id") == "GS"]
        if not gs_segments:
            errors.append("Missing GS segment")
        
        # Check for GE segment
        ge_segments = [s for s in parsed_data.get("segments", []) if s.get("segment_id") == "GE"]
        if not ge_segments:
            errors.append("Missing GE segment")
        
        # Check for ST segment
        st_segments = [s for s in parsed_data.get("segments", []) if s.get("segment_id") == "ST"]
        if not st_segments:
            errors.append("Missing ST segment")
        
        # Check for SE segment
        se_segments = [s for s in parsed_data.get("segments", []) if s.get("segment_id") == "SE"]
        if not se_segments:
            errors.append("Missing SE segment")
        
        return len(errors) == 0, errors


class EDIFACTParser(EDIParser):
    """EDIFACT Parser (Basic implementation)"""
    
    def parse(self, raw_edi: str) -> Dict[str, Any]:
        """Parse EDIFACT document"""
        # Basic EDIFACT parsing
        # Full implementation would parse UNB/UNH segments
        segments = raw_edi.split("'")
        parsed_segments = []
        
        for segment in segments:
            if not segment.strip():
                continue
            
            elements = segment.split("+")
            segment_id = elements[0] if elements else ""
            
            parsed_segments.append({
                "segment_id": segment_id,
                "elements": elements[1:],
                "raw": segment
            })
        
        return {
            "standard": "EDIFACT",
            "segments": parsed_segments,
            "errors": [],
            "warnings": []
        }
    
    def validate(self, parsed_data: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """Validate parsed EDIFACT document"""
        errors = []
        # Basic validation
        return len(errors) == 0, errors


def parse_edi(raw_edi: str, standard: str = "X12") -> Dict[str, Any]:
    """Parse EDI document based on standard"""
    if standard.upper() == "X12":
        parser = X12Parser()
    elif standard.upper() == "EDIFACT":
        parser = EDIFACTParser()
    else:
        raise ValueError(f"Unsupported EDI standard: {standard}")
    
    return parser.parse(raw_edi)
