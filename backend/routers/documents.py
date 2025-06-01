"""
Document management routes
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
import models
import schemas
import auth
from database import get_db
import uuid

router = APIRouter(prefix="/api/docs", tags=["documents"])


@router.get("/", response_model=schemas.DocumentList)
async def list_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = Query(None),
    current_user: Optional[models.User] = Depends(auth.get_current_user_or_guest),
    db: Session = Depends(get_db)
):
    """List documents accessible to the current user"""
    query = db.query(models.Document)
    
    if current_user:
        # Authenticated user: show owned documents and public documents
        query = query.filter(
            or_(
                models.Document.owner_id == current_user.id,
                models.Document.is_public == True
            )
        )
    else:
        # Guest user: show only public documents
        query = query.filter(models.Document.is_public == True)
    
    # Apply search filter
    if search:
        query = query.filter(
            models.Document.name.ilike(f"%{search}%")
        )
    
    # Get total count
    total = query.count()
    
    # Apply pagination and ordering
    documents = query.order_by(
        models.Document.updated_at.desc()
    ).offset(skip).limit(limit).all()
    
    return schemas.DocumentList(documents=documents, total=total)


@router.post("/", response_model=schemas.Document, status_code=status.HTTP_201_CREATED)
async def create_document(
    document: schemas.DocumentCreate,
    current_user: Optional[models.User] = Depends(auth.get_current_user_or_guest),
    db: Session = Depends(get_db)
):
    """Create a new document"""
    db_document = models.Document(
        id=str(uuid.uuid4()),
        name=document.name,
        owner_id=current_user.id if current_user else None,  # Guest users have no owner
        is_public=True if current_user is None else document.is_public,  # Guest documents are always public
        crdt_state=None  # Will be initialized when first accessed
    )
    
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    
    return db_document


@router.get("/{document_id}", response_model=schemas.DocumentWithContent)
async def get_document(
    document_id: str,
    current_user: Optional[models.User] = Depends(auth.get_current_user_or_guest),
    db: Session = Depends(get_db)
):
    """Get a specific document"""
    document = db.query(models.Document).filter(
        models.Document.id == document_id
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check access permissions
    if not document.is_public:
        if not current_user or document.owner_id != current_user.id:
            # Check if user is a collaborator
            if current_user:
                collaborator = db.query(models.DocumentCollaborator).filter(
                    and_(
                        models.DocumentCollaborator.document_id == document_id,
                        models.DocumentCollaborator.user_id == current_user.id
                    )
                ).first()
                
                if not collaborator:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access denied"
                    )
            else:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied"
                )
    
    return document


@router.put("/{document_id}", response_model=schemas.Document)
async def update_document(
    document_id: str,
    document_update: schemas.DocumentUpdate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a document"""
    document = db.query(models.Document).filter(
        models.Document.id == document_id
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check if user is owner
    if document.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only document owner can update document metadata"
        )
    
    # Update fields
    if document_update.name is not None:
        document.name = document_update.name
    
    if document_update.is_public is not None:
        document.is_public = document_update.is_public
    
    db.commit()
    db.refresh(document)
    
    return document


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a document"""
    document = db.query(models.Document).filter(
        models.Document.id == document_id
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check if user is owner
    if document.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only document owner can delete document"
        )
    
    # Delete related records first
    db.query(models.DocumentCollaborator).filter(
        models.DocumentCollaborator.document_id == document_id
    ).delete()
    
    db.query(models.DocumentSession).filter(
        models.DocumentSession.document_id == document_id
    ).delete()
    
    # Delete document
    db.delete(document)
    db.commit()
    
    return None


@router.get("/{document_id}/collaborators", response_model=List[schemas.Collaborator])
async def list_collaborators(
    document_id: str,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """List document collaborators"""
    document = db.query(models.Document).filter(
        models.Document.id == document_id
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check if user has access
    if document.owner_id != current_user.id and not document.is_public:
        collaborator = db.query(models.DocumentCollaborator).filter(
            and_(
                models.DocumentCollaborator.document_id == document_id,
                models.DocumentCollaborator.user_id == current_user.id
            )
        ).first()
        
        if not collaborator:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    collaborators = db.query(models.DocumentCollaborator).filter(
        models.DocumentCollaborator.document_id == document_id
    ).all()
    
    return collaborators


@router.post("/{document_id}/collaborators", response_model=schemas.Collaborator)
async def add_collaborator(
    document_id: str,
    collaborator: schemas.CollaboratorCreate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Add a collaborator to a document"""
    document = db.query(models.Document).filter(
        models.Document.id == document_id
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check if user is owner
    if document.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only document owner can add collaborators"
        )
    
    # Check if user exists
    user_to_add = db.query(models.User).filter(
        models.User.id == collaborator.user_id
    ).first()
    
    if not user_to_add:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if already a collaborator
    existing = db.query(models.DocumentCollaborator).filter(
        and_(
            models.DocumentCollaborator.document_id == document_id,
            models.DocumentCollaborator.user_id == collaborator.user_id
        )
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a collaborator"
        )
    
    # Add collaborator
    db_collaborator = models.DocumentCollaborator(
        document_id=document_id,
        user_id=collaborator.user_id,
        permission=collaborator.permission
    )
    
    db.add(db_collaborator)
    db.commit()
    db.refresh(db_collaborator)
    
    return db_collaborator


@router.delete("/{document_id}/collaborators/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_collaborator(
    document_id: str,
    user_id: str,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Remove a collaborator from a document"""
    document = db.query(models.Document).filter(
        models.Document.id == document_id
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check if user is owner
    if document.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only document owner can remove collaborators"
        )
    
    # Find and remove collaborator
    collaborator = db.query(models.DocumentCollaborator).filter(
        and_(
            models.DocumentCollaborator.document_id == document_id,
            models.DocumentCollaborator.user_id == user_id
        )
    ).first()
    
    if not collaborator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collaborator not found"
        )
    
    db.delete(collaborator)
    db.commit()
    
    return None


@router.get("/{document_id}/sessions", response_model=List[schemas.DocumentSession])
async def list_active_sessions(
    document_id: str,
    current_user: Optional[models.User] = Depends(auth.get_current_user_or_guest),
    db: Session = Depends(get_db)
):
    """List active sessions for a document"""
    document = db.query(models.Document).filter(
        models.Document.id == document_id
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check access permissions
    if not document.is_public:
        if not current_user or document.owner_id != current_user.id:
            # Check if user is a collaborator
            if current_user:
                collaborator = db.query(models.DocumentCollaborator).filter(
                    and_(
                        models.DocumentCollaborator.document_id == document_id,
                        models.DocumentCollaborator.user_id == current_user.id
                    )
                ).first()
                
                if not collaborator:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access denied"
                    )
            else:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied"
                )
    
    # Get active sessions
    sessions = db.query(models.DocumentSession).filter(
        and_(
            models.DocumentSession.document_id == document_id,
            models.DocumentSession.is_active == True
        )
    ).all()
    
    return sessions