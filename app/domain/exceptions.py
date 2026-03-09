class TaskNotFoundError(Exception):
    """Raised when a task does not exist."""


class ForbiddenError(Exception):
    """Raised when a user tries to access another user's resource."""
