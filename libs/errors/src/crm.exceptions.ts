import { HttpStatus } from '@nestjs/common';
import { BosException } from './base.exception';
import { ErrorCode } from './error-codes';

export class ContactNotFoundException extends BosException {
  constructor() {
    super({ code: ErrorCode.CONTACT_NOT_FOUND, message: 'Contact not found', statusCode: HttpStatus.NOT_FOUND });
  }
}

export class LeadNotFoundException extends BosException {
  constructor() {
    super({ code: ErrorCode.LEAD_NOT_FOUND, message: 'Lead not found', statusCode: HttpStatus.NOT_FOUND });
  }
}

export class LeadAlreadyConvertedException extends BosException {
  constructor() {
    super({ code: ErrorCode.LEAD_ALREADY_CONVERTED, message: 'Lead has already been converted', statusCode: HttpStatus.CONFLICT });
  }
}

export class TagNotFoundException extends BosException {
  constructor() {
    super({ code: ErrorCode.TAG_NOT_FOUND, message: 'Tag not found', statusCode: HttpStatus.NOT_FOUND });
  }
}

export class TagNameConflictException extends BosException {
  constructor(name: string) {
    super({ code: ErrorCode.TAG_NAME_CONFLICT, message: `A tag named '${name}' already exists`, statusCode: HttpStatus.CONFLICT });
  }
}

export class ContactListNotFoundException extends BosException {
  constructor() {
    super({ code: ErrorCode.CONTACT_LIST_NOT_FOUND, message: 'Contact list not found', statusCode: HttpStatus.NOT_FOUND });
  }
}

export class ContactListNameConflictException extends BosException {
  constructor(name: string) {
    super({ code: ErrorCode.CONTACT_LIST_NAME_CONFLICT, message: `A contact list named '${name}' already exists in this branch`, statusCode: HttpStatus.CONFLICT });
  }
}

export class ContactSourceNotFoundException extends BosException {
  constructor() {
    super({ code: ErrorCode.CONTACT_SOURCE_NOT_FOUND, message: 'Contact source not found', statusCode: HttpStatus.NOT_FOUND });
  }
}

export class ContactSourceNameConflictException extends BosException {
  constructor(name: string) {
    super({ code: ErrorCode.CONTACT_SOURCE_NAME_CONFLICT, message: `A source named '${name}' already exists in this branch`, statusCode: HttpStatus.CONFLICT });
  }
}

export class LeadStatusNotFoundException extends BosException {
  constructor() {
    super({ code: ErrorCode.LEAD_STATUS_NOT_FOUND, message: 'Lead status not found', statusCode: HttpStatus.NOT_FOUND });
  }
}

export class LeadStatusNameConflictException extends BosException {
  constructor(name: string) {
    super({ code: ErrorCode.LEAD_STATUS_NAME_CONFLICT, message: `A lead status named '${name}' already exists in this branch`, statusCode: HttpStatus.CONFLICT });
  }
}

export class ContactAlreadyInListException extends BosException {
  constructor() {
    super({ code: ErrorCode.CONTACT_ALREADY_IN_LIST, message: 'Contact is already a member of this list', statusCode: HttpStatus.CONFLICT });
  }
}

export class ContactNotInListException extends BosException {
  constructor() {
    super({ code: ErrorCode.CONTACT_NOT_IN_LIST, message: 'Contact is not a member of this list', statusCode: HttpStatus.NOT_FOUND });
  }
}

export class LeadActivityNotFoundException extends BosException {
  constructor() {
    super({ code: ErrorCode.LEAD_ACTIVITY_NOT_FOUND, message: 'Lead activity not found', statusCode: HttpStatus.NOT_FOUND });
  }
}

export class TaskNotFoundException extends BosException {
  constructor() {
    super({ code: ErrorCode.TASK_NOT_FOUND, message: 'Task not found', statusCode: HttpStatus.NOT_FOUND });
  }
}

export class TaskChecklistNotFoundException extends BosException {
  constructor() {
    super({ code: ErrorCode.TASK_CHECKLIST_NOT_FOUND, message: 'Task checklist not found', statusCode: HttpStatus.NOT_FOUND });
  }
}

export class TaskChecklistItemNotFoundException extends BosException {
  constructor() {
    super({ code: ErrorCode.TASK_CHECKLIST_ITEM_NOT_FOUND, message: 'Task checklist item not found', statusCode: HttpStatus.NOT_FOUND });
  }
}
