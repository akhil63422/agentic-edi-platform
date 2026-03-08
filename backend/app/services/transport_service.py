"""
Transport Service
Handles file transfer operations (SFTP, S3, AS2, FTP, API)
"""
import os
import asyncio
from typing import Dict, Any, Optional, List
import logging
from datetime import datetime
from app.core.config import settings

logger = logging.getLogger(__name__)


class TransportService:
    """Transport service for file operations"""
    
    def __init__(self):
        self.s3_client = None
        self._init_s3()
    
    def _init_s3(self):
        """Initialize S3 client if credentials are available"""
        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
            try:
                import boto3
                self.s3_client = boto3.client(
                    's3',
                    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                    region_name=settings.AWS_REGION
                )
            except ImportError:
                logger.warning("boto3 not installed, S3 functionality disabled")
            except Exception as e:
                logger.error(f"Error initializing S3 client: {e}")
    
    async def receive_file_sftp(
        self,
        host: str,
        port: int,
        username: str,
        remote_path: str,
        local_path: str,
        password: Optional[str] = None,
        private_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Receive file via SFTP"""
        try:
            import paramiko
            
            transport = paramiko.Transport((host, port))
            
            if private_key:
                # Use private key authentication
                key = paramiko.RSAKey.from_private_key_file(private_key)
                transport.connect(username=username, pkey=key)
            else:
                # Use password authentication
                transport.connect(username=username, password=password)
            
            sftp = paramiko.SFTPClient.from_transport(transport)
            
            # Download file
            sftp.get(remote_path, local_path)
            
            sftp.close()
            transport.close()
            
            return {
                "success": True,
                "local_path": local_path,
                "file_size": os.path.getsize(local_path)
            }
        
        except Exception as e:
            logger.error(f"Error receiving file via SFTP: {e}")
            return {"success": False, "error": str(e)}
    
    async def receive_file_s3(
        self,
        bucket: str,
        key: str,
        local_path: str
    ) -> Dict[str, Any]:
        """Receive file from S3"""
        try:
            if not self.s3_client:
                return {"success": False, "error": "S3 client not initialized"}
            
            # Download file
            self.s3_client.download_file(bucket, key, local_path)
            
            return {
                "success": True,
                "local_path": local_path,
                "file_size": os.path.getsize(local_path)
            }
        
        except Exception as e:
            logger.error(f"Error receiving file from S3: {e}")
            return {"success": False, "error": str(e)}
    
    async def send_file_sftp(
        self,
        host: str,
        port: int,
        username: str,
        local_path: str,
        remote_path: str,
        password: Optional[str] = None,
        private_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send file via SFTP"""
        try:
            import paramiko
            
            transport = paramiko.Transport((host, port))
            
            if private_key:
                key = paramiko.RSAKey.from_private_key_file(private_key)
                transport.connect(username=username, pkey=key)
            else:
                transport.connect(username=username, password=password)
            
            sftp = paramiko.SFTPClient.from_transport(transport)
            
            # Upload file
            sftp.put(local_path, remote_path)
            
            sftp.close()
            transport.close()
            
            return {"success": True, "remote_path": remote_path}
        
        except Exception as e:
            logger.error(f"Error sending file via SFTP: {e}")
            return {"success": False, "error": str(e)}
    
    async def send_file_s3(
        self,
        local_path: str,
        bucket: str,
        key: str
    ) -> Dict[str, Any]:
        """Send file to S3"""
        try:
            if not self.s3_client:
                return {"success": False, "error": "S3 client not initialized"}
            
            # Upload file
            self.s3_client.upload_file(local_path, bucket, key)
            
            return {"success": True, "bucket": bucket, "key": key}
        
        except Exception as e:
            logger.error(f"Error sending file to S3: {e}")
            return {"success": False, "error": str(e)}
    
    async def receive_file_api(
        self,
        url: str,
        local_path: str,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Receive file via API"""
        try:
            import httpx
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers or {})
                response.raise_for_status()
                
                with open(local_path, 'wb') as f:
                    f.write(response.content)
                
                return {
                    "success": True,
                    "local_path": local_path,
                    "file_size": os.path.getsize(local_path)
                }
        
        except Exception as e:
            logger.error(f"Error receiving file via API: {e}")
            return {"success": False, "error": str(e)}
    
    async def send_file_api(
        self,
        local_path: str,
        url: str,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Send file via API"""
        try:
            import httpx
            
            with open(local_path, 'rb') as f:
                files = {'file': f}
                async with httpx.AsyncClient() as client:
                    response = await client.post(url, files=files, headers=headers or {})
                    response.raise_for_status()
                    
                    return {"success": True, "response": response.json()}
        
        except Exception as e:
            logger.error(f"Error sending file via API: {e}")
            return {"success": False, "error": str(e)}
    
    def list_files(self, transport_config: Dict[str, Any]) -> List[Dict[str, Any]]:
        """List files from SFTP or S3 (sync, for use in thread)."""
        transport_type = transport_config.get("type")
        files_found = []
        try:
            if transport_type == "SFTP":
                host = transport_config.get("endpoint", {}).get("host")
                port = transport_config.get("endpoint", {}).get("port", 22)
                username = transport_config.get("credentials", {}).get("username")
                password = transport_config.get("credentials", {}).get("password")
                remote_path = transport_config.get("remote_path", "/")

                import paramiko
                transport = paramiko.Transport((host, port))
                transport.connect(username=username, password=password)
                sftp = paramiko.SFTPClient.from_transport(transport)
                files = sftp.listdir(remote_path)
                for file in files:
                    if file.endswith(('.edi', '.x12', '.txt')):
                        files_found.append({
                            "name": file,
                            "path": f"{remote_path.rstrip('/')}/{file}",
                            "transport_type": "SFTP"
                        })
                sftp.close()
                transport.close()
            elif transport_type == "S3":
                bucket = transport_config.get("bucket")
                prefix = transport_config.get("prefix", "")
                if self.s3_client:
                    response = self.s3_client.list_objects_v2(Bucket=bucket, Prefix=prefix)
                    for obj in response.get("Contents", []):
                        if obj["Key"].endswith(('.edi', '.x12', '.txt')):
                            files_found.append({
                                "name": os.path.basename(obj["Key"]),
                                "path": obj["Key"],
                                "transport_type": "S3",
                                "size": obj["Size"]
                            })
        except Exception as e:
            logger.error(f"Error listing files: {e}")
        return files_found

    async def poll_for_files(
        self,
        transport_config: Dict[str, Any],
        callback: callable
    ) -> List[Dict[str, Any]]:
        """Poll for new files based on transport configuration"""
        files_found = self.list_files(transport_config)
        for file_info in files_found:
            await callback(file_info)
        return files_found


# Global transport service instance
transport_service = TransportService()
