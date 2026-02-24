"""
Encryption middleware for sensitive data
"""
from cryptography.fernet import Fernet
import base64
import os
from typing import Optional

class EncryptionService:
    """Service for encrypting/decrypting sensitive data"""
    
    def __init__(self):
        # In production, load from secure key management system
        key = os.getenv("ENCRYPTION_KEY")
        if not key:
            # Generate a key for development (DO NOT use in production)
            key = Fernet.generate_key().decode()
        self.cipher = Fernet(key.encode() if isinstance(key, str) else key)
    
    def encrypt(self, data: str) -> str:
        """Encrypt sensitive data"""
        if not data:
            return data
        encrypted = self.cipher.encrypt(data.encode())
        return base64.b64encode(encrypted).decode()
    
    def decrypt(self, encrypted_data: str) -> str:
        """Decrypt sensitive data"""
        if not encrypted_data:
            return encrypted_data
        try:
            decoded = base64.b64decode(encrypted_data.encode())
            decrypted = self.cipher.decrypt(decoded)
            return decrypted.decode()
        except Exception as e:
            logger.error(f"Error decrypting data: {e}")
            raise


# Global encryption service
encryption_service = EncryptionService()
