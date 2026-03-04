import { describe, expect, it } from 'vitest';
import {
  generateGroupRegistrationAcknowledgementEmail,
  generateGroupRegistrationEmail,
} from './email';

describe('group registration emails', () => {
  it('generates admin notification email for group registration', () => {
    const email = generateGroupRegistrationEmail({
      groupName: 'Association Al Amal',
      responsibleName: 'Fatima Zahra',
      responsibleEmail: 'fatima@example.com',
      responsiblePhone: '+212600000000',
      estimatedSize: 25,
      volunteerSlots: ['preparation_ftour', 'service_ftour'],
      dayNumber: 12,
      dayDate: 'mercredi 12 mars',
      startTime: '18h30',
      fileName: 'membres.xlsx',
    });

    expect(email.subject).toContain('[Groupe]');
    expect(email.subject).toContain('Association Al Amal');
    expect(email.html).toContain('Nouvelle inscription groupe bénévole');
    expect(email.html).toContain('fatima@example.com');
    expect(email.html).toContain('membres.xlsx');
    expect(email.html).toContain('15:30');
    expect(email.html).toContain('20:00');
  });

  it('generates acknowledgement email for group responsible', () => {
    const email = generateGroupRegistrationAcknowledgementEmail({
      responsibleName: 'Fatima Zahra',
      groupName: 'Association Al Amal',
      dayNumber: 12,
      dayDate: 'mercredi 12 mars',
      estimatedSize: 25,
      volunteerSlots: ['preparation_ftour', 'service_ftour'],
      startTime: '18h30',
    });

    expect(email.subject).toContain('Demande groupe reçue');
    expect(email.subject).toContain('Association Al Amal');
    expect(email.html).toContain('Votre demande groupe a bien été reçue');
    expect(email.html).toContain('Fatima Zahra');
    expect(email.html).toContain('12 du Ramadan');
    expect(email.html).toContain('25 personnes');
    expect(email.html).toContain('15:30');
    expect(email.html).toContain('20:00');
  });

  it('escapes html in acknowledgement fields', () => {
    const email = generateGroupRegistrationAcknowledgementEmail({
      responsibleName: '<img src=x onerror=alert(1)>',
      groupName: '<script>alert(1)</script>',
      volunteerSlots: ['<b>custom</b>'],
    });

    expect(email.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(email.html).toContain('&lt;b&gt;custom&lt;/b&gt;');
    expect(email.html).not.toContain('<script>alert(1)</script>');
  });

});
