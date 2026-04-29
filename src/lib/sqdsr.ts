import { buildDataset } from './dataset';

type Dataset = ReturnType<typeof buildDataset>;

export function serialise(dataset: Dataset): string {
  const { security, version, commonData, dynamicData, ticketBlock } = dataset;

  const svcFields = [
    security.fields[0].hex,
    version.fields[0].hex,
    ...commonData.fields.map(f => f.hex),
  ].join('|');

  const dynFields = dynamicData.fields.map(f => f.hex).join('|');

  const tktFields = ticketBlock.ticket.map(f => f.hex).join('|');
  const tktPart   = `(${ticketBlock.opId}|${ticketBlock.noTkts}|${ticketBlock.valInfo}|[${tktFields}])`;

  return `{${svcFields}}|{${dynFields}}|{${tktPart}}`;
}

export function assembleFinal(plaintext: string, signatureB64: string): string {
  return `${plaintext}|{SIG:${signatureB64}}`;
}
