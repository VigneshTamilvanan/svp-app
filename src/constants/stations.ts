export const CMRL = {
  TG_ID:       0x0001,
  OPERATOR_ID: 0x0087,
  SERVICE_ID:  0x01,
  PRODUCT_SVP: 0x0005,
  ANY_STATION: 0x0000,
};

export const LINE = {
  BLUE:  'Blue',
  GREEN: 'Green',
  BOTH:  'Both',
};

export const STATIONS = [
  { code: 0x01, name: 'Chennai Airport',    line: LINE.BLUE,  stationCode: 'SAP|0133' },
  { code: 0x02, name: 'Meenambakkam',       line: LINE.BLUE,  stationCode: 'SME|0131' },
  { code: 0x03, name: 'Nanganallur Road',   line: LINE.BLUE,  stationCode: 'SOT|0129' },
  { code: 0x04, name: 'Alandur',            line: LINE.BOTH,  stationCode: 'SAL|0231' },
  { code: 0x05, name: 'St. Thomas Mount',   line: LINE.BOTH,  stationCode: 'SMM|0233' },
  { code: 0x06, name: 'Guindy',             line: LINE.BLUE,  stationCode: 'SGU|0125' },
  { code: 0x07, name: 'Little Mount',       line: LINE.BLUE,  stationCode: 'SLM|0123' },
  { code: 0x08, name: 'Saidapet',           line: LINE.BLUE,  stationCode: 'SSA|0121' },
  { code: 0x09, name: 'Nandanam',           line: LINE.BLUE,  stationCode: 'SCR|0119' },
  { code: 0x0A, name: 'AG-DMS',             line: LINE.BLUE,  stationCode: 'SGM|0115' },
  { code: 0x0B, name: 'Teynampet',          line: LINE.BLUE,  stationCode: 'STE|0117' },
  { code: 0x0C, name: 'Thousand Lights',    line: LINE.BLUE,  stationCode: 'STL|0113' },
  { code: 0x0D, name: 'LIC',                line: LINE.BLUE,  stationCode: 'SLI|0111' },
  { code: 0x0E, name: 'Government Estate',  line: LINE.BLUE,  stationCode: 'SGE|0109' },
  { code: 0x0F, name: 'Central (MGR)',       line: LINE.BOTH,  stationCode: 'SCC|0201' },
  { code: 0x10, name: 'Mannadi',            line: LINE.BLUE,  stationCode: 'SMA|0103' },
  { code: 0x11, name: 'Chennai Beach',      line: LINE.BLUE,  stationCode: 'SHC|0105' },
  { code: 0x12, name: 'CMBT',              line: LINE.GREEN, stationCode: 'SCM|0221' },
  { code: 0x13, name: 'Ashok Nagar',        line: LINE.GREEN, stationCode: 'SAN|0227' },
  { code: 0x14, name: 'Vadapalani',         line: LINE.GREEN, stationCode: 'SVA|0225' },
  { code: 0x15, name: 'Arumbakkam',         line: LINE.GREEN, stationCode: 'SAR|0223' },
  { code: 0x16, name: 'Koyambedu',          line: LINE.GREEN, stationCode: 'SKO|0219' },
  { code: 0x17, name: 'CMRL HQ',            line: LINE.GREEN, stationCode: 'STI|0217' },
  { code: 0x18, name: 'Nehru Park',         line: LINE.GREEN, stationCode: 'SNP|0205' },
  { code: 0x19, name: 'Puratchi Thalaivar', line: LINE.GREEN, stationCode: 'SAT|0215' },
  { code: 0x1A, name: 'Wimco Nagar',        line: LINE.GREEN, stationCode: 'SWN|0137' },
];

export function getStation(code: number) {
  return STATIONS.find(s => s.code === code);
}
