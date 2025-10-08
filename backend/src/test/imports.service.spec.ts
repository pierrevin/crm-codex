import { ImportStatus } from '@prisma/client';
import { ImportsService } from '../imports/imports.service';

describe('ImportsService', () => {
  it('imports contacts from CSV', async () => {
    const prismaMock = {
      importJob: {
        create: jest.fn().mockResolvedValue({ id: 'job1' }),
        update: jest.fn().mockResolvedValue({})
      }
    } as any;
    const contactsMock = {
      create: jest.fn().mockResolvedValue({ id: 'contact1' })
    } as any;
    const auditMock = {
      log: jest.fn().mockResolvedValue(undefined)
    } as any;
    const service = new ImportsService(prismaMock, contactsMock, auditMock);
    await service.importCsv(
      'contacts.csv',
      'firstName,lastName,email\nJohn,Doe,john@example.com'
    );

    expect(prismaMock.importJob.create).toHaveBeenCalled();
    expect(contactsMock.create).toHaveBeenCalledWith({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: undefined
    });
    expect(prismaMock.importJob.update).toHaveBeenCalledWith({
      where: { id: 'job1' },
      data: { status: ImportStatus.COMPLETED }
    });
  });
});
