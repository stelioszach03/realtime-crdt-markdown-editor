"""
Pydantic schemas for request/response validation
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# User schemas
class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: Optional[EmailStr] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=100)


class UserLogin(BaseModel):
    username: str
    password: str


class User(UserBase):
    id: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserInDB(User):
    hashed_password: str


# Document schemas
class DocumentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    is_public: bool = False


class DocumentCreate(DocumentBase):
    pass


class DocumentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    is_public: Optional[bool] = None


class Document(DocumentBase):
    id: str
    owner_id: Optional[str] = None  # Nullable for guest documents
    created_at: datetime
    updated_at: Optional[datetime]
    word_count: Optional[int] = 0  # Make it optional with default 0
    
    class Config:
        from_attributes = True


class DocumentWithContent(Document):
    crdt_state: Optional[str] = None


class DocumentList(BaseModel):
    documents: List[Document]
    total: int


# Authentication schemas
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class TokenData(BaseModel):
    username: Optional[str] = None


# WebSocket schemas
class WSMessage(BaseModel):
    type: str  # 'operation', 'cursor', 'presence'
    data: Dict[str, Any]


class CRDTOperationMessage(BaseModel):
    type: str  # 'insert' or 'delete'
    node: Dict[str, Any]
    origin: str


class PresenceMessage(BaseModel):
    user_id: str
    username: str
    cursor_position: Optional[int] = None
    selection_start: Optional[int] = None
    selection_end: Optional[int] = None


# Collaborator schemas
class CollaboratorBase(BaseModel):
    user_id: str
    permission: str = "edit"


class CollaboratorCreate(CollaboratorBase):
    pass


class Collaborator(CollaboratorBase):
    id: int
    document_id: str
    created_at: datetime
    user: User
    
    class Config:
        from_attributes = True


# Session schemas
class DocumentSession(BaseModel):
    id: str
    document_id: str
    user_id: Optional[str]
    site_id: str
    is_active: bool
    last_seen: datetime
    
    class Config:
        from_attributes = True


# Error schemas
class ErrorResponse(BaseModel):
    detail: str
    error_code: Optional[str] = None


class ValidationErrorResponse(BaseModel):
    detail: List[Dict[str, Any]]
    error_code: str = "validation_error"