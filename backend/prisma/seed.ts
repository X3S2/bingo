import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const IMPRESSUM_TEMPLATE = `# Impressum

**Angaben gemäß § 5 TMG**

[VORNAME NACHNAME]
[STRASSE HAUSNUMMER]
[PLZ ORT]

**Kontakt**

Telefon: [TELEFONNUMMER]
E-Mail: [EMAIL@EXAMPLE.COM]

---

**Hinweis:** Bitte ersetze alle mit [ ] gekennzeichneten Platzhalter durch deine tatsächlichen Angaben. Die Angaben im Impressum sind gesetzlich vorgeschrieben (§ 5 TMG).

Dieses Impressum gilt für die Domain: [DEINE-DOMAIN]`;

const DATENSCHUTZ_TEMPLATE = `# Datenschutzerklärung

**Stand:** [MONAT JAHR]

## 1. Verantwortlicher

Verantwortlich für die Verarbeitung personenbezogener Daten auf dieser Website:

[VORNAME NACHNAME]
[STRASSE HAUSNUMMER]
[PLZ ORT]
E-Mail: [EMAIL@EXAMPLE.COM]

## 2. Erhobene Daten

Beim Besuch und der Nutzung von StreamBingo werden folgende personenbezogene Daten verarbeitet:

- **Twitch-Nutzerdaten**: Nutzername, Twitch-ID und Profilbild (übermittelt durch Twitch OAuth2)
- **Sitzungsdaten**: Technische Sitzungsinformationen (JWT-Token, Cookie)
- **Nutzungsprotokoll**: Bingo-Spielverlauf, Gewinner-Status

## 3. Rechtsgrundlage (DSGVO)

Die Verarbeitung erfolgt auf Grundlage von:
- **Art. 6 Abs. 1 lit. b DSGVO** – Vertragserfüllung (Spielteilnahme)
- **Art. 6 Abs. 1 lit. f DSGVO** – Berechtigtes Interesse (Sicherheit, Missbrauchsschutz)

## 4. Cookies

Diese Seite verwendet ausschließlich technisch notwendige Cookies:
- \`access_token\`: JWT-Authentifizierungstoken (HttpOnly, 7 Tage)
- \`locale\`: Spracheinstellung (1 Jahr)

Es werden **keine** Tracking- oder Werbe-Cookies eingesetzt.

## 5. Weitergabe an Dritte

Daten werden nicht an Dritte weitergegeben, mit Ausnahme von:
- **Twitch Interactive Inc.** (OAuth2-Authentifizierungsdienstleister, USA) – Datenschutzerklärung: https://www.twitch.tv/p/de-de/legal/privacy-notice/

Beim Einsatz von Twitch-Diensten gelten die Standardvertragsklauseln der EU (Art. 46 DSGVO).

## 6. Speicherdauer

Personenbezogene Daten werden gespeichert, solange du an StreamBingo teilnimmst. Du kannst die Löschung deines Accounts jederzeit per E-Mail an [EMAIL@EXAMPLE.COM] beantragen.

## 7. Deine Rechte (Art. 15–22 DSGVO)

Du hast das Recht auf:
- **Auskunft** (Art. 15 DSGVO)
- **Berichtigung** (Art. 16 DSGVO)
- **Löschung** (Art. 17 DSGVO)
- **Einschränkung** (Art. 18 DSGVO)
- **Datenübertragbarkeit** (Art. 20 DSGVO)
- **Widerspruch** (Art. 21 DSGVO)

Zur Ausübung deiner Rechte kontaktiere: [EMAIL@EXAMPLE.COM]

Beschwerden können bei der zuständigen Datenschutzbehörde eingereicht werden:
**[ZUSTÄNDIGE AUFSICHTSBEHÖRDE – z.B. Landesbeauftragte für Datenschutz]**
Website: [LINK ZUR AUFSICHTSBEHÖRDE]

## 8. Hosting

Diese Website wird gehostet bei: [HOSTING-ANBIETER / Eigenhosting auf Synology NAS]
Serverstandort: [DEUTSCHLAND / EU]

---

**Hinweis:** Bitte ersetze alle [ ] Platzhalter durch deine tatsächlichen Angaben. Diese Vorlage ersetzt keine rechtliche Beratung.`;

async function main() {
  const defaults: Array<{ key: string; value: string }> = [
    { key: 'setup_complete', value: 'false' },
    { key: 'maintenance_enabled', value: 'false' },
    {
      key: 'maintenance_message',
      value: 'StreamBingo befindet sich derzeit in Wartung. Bitte versuche es später erneut.',
    },
    { key: 'impressum', value: IMPRESSUM_TEMPLATE },
    { key: 'datenschutz', value: DATENSCHUTZ_TEMPLATE },
  ];

  for (const setting of defaults) {
    await prisma.adminSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log('✅ Database seeded with default AdminSettings');
  console.log('⚠️  Remember to update impressum and datenschutz with your actual data!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

