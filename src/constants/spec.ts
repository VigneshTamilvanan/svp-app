export const TAG = {
  QR_SECURITY:     0x81,
  DATASET_VERSION: 0x82,
  COMMON_DATA:     0x83,
  DYNAMIC_DATA:    0x84,
  TICKET_BLOCK:    0x85,
};

export const SECURITY_SCHEME = {
  NONE:            0x00,
  CHECKSUM:        0x01,
  CRYPTO_CHECKSUM: 0x02,
  RSA_SIGN:        0x03,
  SECURE_QR_ALPHA: 0x04,
  SECURE_QR_BETA:  0x05,
  SECURE_QR_GAMMA: 0x06,
};

export const DATASET_VERSION = 0x04;

export const TXN_TYPE = {
  PURCHASE:     0x41,
  TRANSACTION:  0x42,
  VERIFICATION: 0x43,
  ERROR:        0x44,
  UPDATE:       0x45,
};

export const QR_STATE = {
  INACTIVE: 0,
  ACTIVE:   1,
  ENTRY:    2,
  EXIT:     3,
  TAP:      4,
  INVALID:  5,
};

export const LANG = {
  ENGLISH: 0x00,
  HINDI:   0x01,
  TAMIL:   0x05,
};

export const COMMON_DATA_FIELDS = {
  LANGUAGE:     1,
  TG_ID:        2,
  TXN_TYPE:     1,
  SERIAL_NO:    8,
  GEN_DATETIME: 4,
  REQUESTER_ID: 4,
  TXN_REF:      22,
  TOTAL_FARE:   4,
  BOOKING_LAT:  3,
  BOOKING_LONG: 3,
  MOBILE:       10,
};

export const DYNAMIC_DATA_FIELDS = {
  QR_UPDATED_TIME: 4,
  QR_STATUS:       3,
  LATITUDE:        3,
  LONGITUDE:       3,
  OP_SPECIFIC:     19,
};

export const TICKET_FIELDS = {
  GROUP_SIZE:     1,
  SRC_STATION:    2,
  DST_STATION:    2,
  ACTIVATION_DT:  4,
  PRODUCT_ID:     2,
  SERVICE_ID:     1,
  TICKET_FARE:    4,
  VALIDITY:       2,
  DURATION:       2,
  OP_TICKET_DATA: 8,
};

export const QR_SOURCE = {
  UNDEFINED: 0b00,
  MOBILE:    0b01,
  WEBCLIENT: 0b10,
  TOM:       0b11,
};

export const SVP_DEFAULTS = {
  VALIDITY_MINS: 480,
  DURATION_MINS: 180,
  MIN_BALANCE:   5000,
  MAX_BALANCE:   1000000,
};
