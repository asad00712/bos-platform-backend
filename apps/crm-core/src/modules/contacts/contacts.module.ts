import { Module } from '@nestjs/common';
import { TagsModule } from '../tags/tags.module';
import { ContactsController } from './contacts.controller';
import { ContactSourcesController } from './contact-sources.controller';
import { ContactListsController } from './contact-lists.controller';
import { ContactService } from './services/contact.service';
import { ContactSourceService } from './services/contact-source.service';
import { ContactListService } from './services/contact-list.service';
import { ContactRepository } from './repositories/contact.repository';
import { ContactSourceRepository } from './repositories/contact-source.repository';
import { ContactListRepository } from './repositories/contact-list.repository';

@Module({
  imports: [TagsModule],
  controllers: [ContactsController, ContactSourcesController, ContactListsController],
  providers: [
    ContactService,
    ContactSourceService,
    ContactListService,
    ContactRepository,
    ContactSourceRepository,
    ContactListRepository,
  ],
  exports: [ContactService, ContactRepository, ContactSourceService],
})
export class ContactsModule {}
