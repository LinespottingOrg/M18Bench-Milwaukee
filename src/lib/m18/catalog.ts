/** Register map from the community M18 protocol research (m18.py data_id / data_matrix). */
export type Kind =
  | "uint"
  | "date"
  | "ascii"
  | "sn"
  | "adc_t"
  | "dec_t"
  | "cell_v"
  | "hhmmss";

export interface RegDef {
  index: number;
  addr: number;
  len: number;
  kind: Kind;
  label: string;
}

export interface MatrixBlock {
  addr: number;
  len: number;
}

export const REGISTERS: RegDef[] = [
  {
    "index": 0,
    "addr": 0,
    "len": 2,
    "kind": "uint",
    "label": "Cell type"
  },
  {
    "index": 1,
    "addr": 2,
    "len": 2,
    "kind": "uint",
    "label": "Unknown (always 0)"
  },
  {
    "index": 2,
    "addr": 4,
    "len": 5,
    "kind": "sn",
    "label": "Capacity & Serial number (?)"
  },
  {
    "index": 3,
    "addr": 13,
    "len": 4,
    "kind": "uint",
    "label": "Unknown (4th code?)"
  },
  {
    "index": 4,
    "addr": 17,
    "len": 4,
    "kind": "date",
    "label": "Manufacture date"
  },
  {
    "index": 5,
    "addr": 21,
    "len": 4,
    "kind": "date",
    "label": "Date of first charge (Forge)"
  },
  {
    "index": 6,
    "addr": 25,
    "len": 4,
    "kind": "date",
    "label": "Date of last charge (Forge)"
  },
  {
    "index": 7,
    "addr": 35,
    "len": 20,
    "kind": "ascii",
    "label": "Note (ascii string)"
  },
  {
    "index": 8,
    "addr": 55,
    "len": 4,
    "kind": "date",
    "label": "Current date"
  },
  {
    "index": 9,
    "addr": 105,
    "len": 2,
    "kind": "uint",
    "label": "Unknown (always 2)"
  },
  {
    "index": 10,
    "addr": 123,
    "len": 1,
    "kind": "uint",
    "label": "Unknown (always 0)"
  },
  {
    "index": 11,
    "addr": 16384,
    "len": 4,
    "kind": "uint",
    "label": "Unknown (Forge)"
  },
  {
    "index": 12,
    "addr": 16394,
    "len": 10,
    "kind": "cell_v",
    "label": "Cell voltages (mV)"
  },
  {
    "index": 13,
    "addr": 16404,
    "len": 2,
    "kind": "adc_t",
    "label": "Temperature (C) (non-Forge)"
  },
  {
    "index": 14,
    "addr": 16406,
    "len": 2,
    "kind": "uint",
    "label": "Unknown (Forge)"
  },
  {
    "index": 15,
    "addr": 16409,
    "len": 2,
    "kind": "uint",
    "label": "Unknown (Forge)"
  },
  {
    "index": 16,
    "addr": 16411,
    "len": 2,
    "kind": "uint",
    "label": "Unknown (Forge)"
  },
  {
    "index": 17,
    "addr": 16413,
    "len": 2,
    "kind": "uint",
    "label": "Unknown (Forge)"
  },
  {
    "index": 18,
    "addr": 16415,
    "len": 2,
    "kind": "dec_t",
    "label": "Temperature (C) (Forge)"
  },
  {
    "index": 19,
    "addr": 24576,
    "len": 2,
    "kind": "uint",
    "label": "Unknown (Forge)"
  },
  {
    "index": 20,
    "addr": 24578,
    "len": 2,
    "kind": "uint",
    "label": "Unknown (Forge)"
  },
  {
    "index": 21,
    "addr": 24580,
    "len": 4,
    "kind": "uint",
    "label": "Unknown (Forge)"
  },
  {
    "index": 22,
    "addr": 24584,
    "len": 4,
    "kind": "uint",
    "label": "Unknown (Forge)"
  },
  {
    "index": 23,
    "addr": 24588,
    "len": 2,
    "kind": "uint",
    "label": "Unknown (Forge)"
  },
  {
    "index": 24,
    "addr": 36864,
    "len": 4,
    "kind": "date",
    "label": "Date of first charge (rounded)"
  },
  {
    "index": 25,
    "addr": 36868,
    "len": 4,
    "kind": "date",
    "label": "Date of last tool use (rounded)"
  },
  {
    "index": 26,
    "addr": 36872,
    "len": 4,
    "kind": "date",
    "label": "Date of last charge (rounded)"
  },
  {
    "index": 27,
    "addr": 36876,
    "len": 4,
    "kind": "date",
    "label": "Unknown date (often zero)"
  },
  {
    "index": 28,
    "addr": 36880,
    "len": 2,
    "kind": "uint",
    "label": "Days since first charge"
  },
  {
    "index": 29,
    "addr": 36882,
    "len": 4,
    "kind": "uint",
    "label": "Total discharge (amp-sec)"
  },
  {
    "index": 30,
    "addr": 36886,
    "len": 4,
    "kind": "uint",
    "label": "Total discharge (watt-sec or joules)"
  },
  {
    "index": 31,
    "addr": 36890,
    "len": 4,
    "kind": "uint",
    "label": "Total charge count"
  },
  {
    "index": 32,
    "addr": 36894,
    "len": 2,
    "kind": "uint",
    "label": "Dumb charge count (J2>7.1V for >=0.48s)"
  },
  {
    "index": 33,
    "addr": 36896,
    "len": 2,
    "kind": "uint",
    "label": "Redlink (UART) charge count"
  },
  {
    "index": 34,
    "addr": 36898,
    "len": 2,
    "kind": "uint",
    "label": "Completed charge count (?)"
  },
  {
    "index": 35,
    "addr": 36900,
    "len": 4,
    "kind": "hhmmss",
    "label": "Total charging time (HH:MM:SS)"
  },
  {
    "index": 36,
    "addr": 36904,
    "len": 4,
    "kind": "hhmmss",
    "label": "Time on charger whilst full (HH:MM:SS)"
  },
  {
    "index": 37,
    "addr": 36908,
    "len": 2,
    "kind": "uint",
    "label": "Unknown (another low-voltage charge counter?)"
  },
  {
    "index": 38,
    "addr": 36910,
    "len": 2,
    "kind": "uint",
    "label": "Charge started with a cell < 2.5V"
  },
  {
    "index": 39,
    "addr": 36912,
    "len": 2,
    "kind": "uint",
    "label": "Discharge to empty"
  },
  {
    "index": 40,
    "addr": 36914,
    "len": 2,
    "kind": "uint",
    "label": "Num. overheat on tool (must be > 10A)"
  },
  {
    "index": 41,
    "addr": 36916,
    "len": 2,
    "kind": "uint",
    "label": "Overcurrent?"
  },
  {
    "index": 42,
    "addr": 36918,
    "len": 2,
    "kind": "uint",
    "label": "Low voltage events)"
  },
  {
    "index": 43,
    "addr": 36920,
    "len": 2,
    "kind": "uint",
    "label": "Low-voltage bounce? (4 flashing LEDs)"
  },
  {
    "index": 44,
    "addr": 36922,
    "len": 2,
    "kind": "uint",
    "label": "Discharge @ 10-20A (seconds)"
  },
  {
    "index": 45,
    "addr": 36924,
    "len": 2,
    "kind": "uint",
    "label": "@ 20-30A (could be watts)"
  },
  {
    "index": 46,
    "addr": 36926,
    "len": 2,
    "kind": "uint",
    "label": "@ 30-40A"
  },
  {
    "index": 47,
    "addr": 36928,
    "len": 2,
    "kind": "uint",
    "label": "@ 40-50A"
  },
  {
    "index": 48,
    "addr": 36930,
    "len": 2,
    "kind": "uint",
    "label": "@ 50-60A"
  },
  {
    "index": 49,
    "addr": 36932,
    "len": 2,
    "kind": "uint",
    "label": "@ 60-70A"
  },
  {
    "index": 50,
    "addr": 36934,
    "len": 2,
    "kind": "uint",
    "label": "@ 70-80A"
  },
  {
    "index": 51,
    "addr": 36936,
    "len": 2,
    "kind": "uint",
    "label": "@ 80-90A"
  },
  {
    "index": 52,
    "addr": 36938,
    "len": 2,
    "kind": "uint",
    "label": "@ 90-100A"
  },
  {
    "index": 53,
    "addr": 36940,
    "len": 2,
    "kind": "uint",
    "label": "@ 100-110A"
  },
  {
    "index": 54,
    "addr": 36942,
    "len": 2,
    "kind": "uint",
    "label": "@ 110-120A"
  },
  {
    "index": 55,
    "addr": 36944,
    "len": 2,
    "kind": "uint",
    "label": "@ 120-130A"
  },
  {
    "index": 56,
    "addr": 36946,
    "len": 2,
    "kind": "uint",
    "label": "@ 130-140A"
  },
  {
    "index": 57,
    "addr": 36948,
    "len": 2,
    "kind": "uint",
    "label": "@ 140-150A"
  },
  {
    "index": 58,
    "addr": 36950,
    "len": 2,
    "kind": "uint",
    "label": "@ 150-160A"
  },
  {
    "index": 59,
    "addr": 36952,
    "len": 2,
    "kind": "uint",
    "label": "@ 160-170A"
  },
  {
    "index": 60,
    "addr": 36954,
    "len": 2,
    "kind": "uint",
    "label": "@ 170-180A"
  },
  {
    "index": 61,
    "addr": 36956,
    "len": 2,
    "kind": "uint",
    "label": "@ 180-190A"
  },
  {
    "index": 62,
    "addr": 36958,
    "len": 2,
    "kind": "uint",
    "label": "@ 190-200A"
  },
  {
    "index": 63,
    "addr": 36960,
    "len": 2,
    "kind": "uint",
    "label": "@ 200-210A"
  },
  {
    "index": 64,
    "addr": 36962,
    "len": 2,
    "kind": "uint",
    "label": "Discharge @ 5-10A (seconds)"
  },
  {
    "index": 65,
    "addr": 36964,
    "len": 2,
    "kind": "uint",
    "label": "@ 10-15A (could be watts)"
  },
  {
    "index": 66,
    "addr": 36966,
    "len": 2,
    "kind": "uint",
    "label": "@ 15-20A (histo not well understood yet)"
  },
  {
    "index": 67,
    "addr": 36968,
    "len": 2,
    "kind": "uint",
    "label": "@ 20-25A"
  },
  {
    "index": 68,
    "addr": 36970,
    "len": 2,
    "kind": "uint",
    "label": "@ 25-30A"
  },
  {
    "index": 69,
    "addr": 36972,
    "len": 2,
    "kind": "uint",
    "label": "@ 30-35A"
  },
  {
    "index": 70,
    "addr": 36974,
    "len": 2,
    "kind": "uint",
    "label": "@ 35-40A"
  },
  {
    "index": 71,
    "addr": 36976,
    "len": 2,
    "kind": "uint",
    "label": "@ 40-45A"
  },
  {
    "index": 72,
    "addr": 36978,
    "len": 2,
    "kind": "uint",
    "label": "@ 45-50A"
  },
  {
    "index": 73,
    "addr": 36980,
    "len": 2,
    "kind": "uint",
    "label": "@ 50-55A"
  },
  {
    "index": 74,
    "addr": 36982,
    "len": 2,
    "kind": "uint",
    "label": "@ 55-60A"
  },
  {
    "index": 75,
    "addr": 36984,
    "len": 2,
    "kind": "uint",
    "label": "@ 60-65A"
  },
  {
    "index": 76,
    "addr": 36986,
    "len": 2,
    "kind": "uint",
    "label": "@ 65-70A"
  },
  {
    "index": 77,
    "addr": 36988,
    "len": 2,
    "kind": "uint",
    "label": "@ 70-65A"
  },
  {
    "index": 78,
    "addr": 36990,
    "len": 2,
    "kind": "uint",
    "label": "@ 75-80A"
  },
  {
    "index": 79,
    "addr": 36992,
    "len": 2,
    "kind": "uint",
    "label": "@ 80-85A"
  },
  {
    "index": 80,
    "addr": 36994,
    "len": 2,
    "kind": "uint",
    "label": "@ 85-90A"
  },
  {
    "index": 81,
    "addr": 36996,
    "len": 2,
    "kind": "uint",
    "label": "@ 90-95A"
  },
  {
    "index": 82,
    "addr": 36998,
    "len": 2,
    "kind": "uint",
    "label": "@ 95-100A"
  },
  {
    "index": 83,
    "addr": 37000,
    "len": 2,
    "kind": "uint",
    "label": "@ 100-105A"
  },
  {
    "index": 84,
    "addr": 37002,
    "len": 2,
    "kind": "uint",
    "label": "@ 105-110A"
  },
  {
    "index": 85,
    "addr": 37004,
    "len": 2,
    "kind": "uint",
    "label": "@ 110-115A"
  },
  {
    "index": 86,
    "addr": 37006,
    "len": 2,
    "kind": "uint",
    "label": "@ 115-120A"
  },
  {
    "index": 87,
    "addr": 37008,
    "len": 2,
    "kind": "uint",
    "label": "@ 120-125A"
  },
  {
    "index": 88,
    "addr": 37010,
    "len": 2,
    "kind": "uint",
    "label": "@ 125-130A"
  },
  {
    "index": 89,
    "addr": 37012,
    "len": 2,
    "kind": "uint",
    "label": "@ 130-135A"
  },
  {
    "index": 90,
    "addr": 37014,
    "len": 2,
    "kind": "uint",
    "label": "@ 135-140A"
  },
  {
    "index": 91,
    "addr": 37016,
    "len": 2,
    "kind": "uint",
    "label": "@ 140-145A"
  },
  {
    "index": 92,
    "addr": 37018,
    "len": 2,
    "kind": "uint",
    "label": "@ 145-150A"
  },
  {
    "index": 93,
    "addr": 37020,
    "len": 2,
    "kind": "uint",
    "label": "@ 150-155A"
  },
  {
    "index": 94,
    "addr": 37022,
    "len": 2,
    "kind": "uint",
    "label": "@ 155-160A"
  },
  {
    "index": 95,
    "addr": 37024,
    "len": 2,
    "kind": "uint",
    "label": "@ 160-165A"
  },
  {
    "index": 96,
    "addr": 37026,
    "len": 2,
    "kind": "uint",
    "label": "@ 165-170A"
  },
  {
    "index": 97,
    "addr": 37028,
    "len": 2,
    "kind": "uint",
    "label": "@ 170-175A"
  },
  {
    "index": 98,
    "addr": 37030,
    "len": 2,
    "kind": "uint",
    "label": "@ 175-180A"
  },
  {
    "index": 99,
    "addr": 37032,
    "len": 2,
    "kind": "uint",
    "label": "@ 180-185A"
  },
  {
    "index": 100,
    "addr": 37034,
    "len": 2,
    "kind": "uint",
    "label": "@ 185-190A"
  },
  {
    "index": 101,
    "addr": 37036,
    "len": 2,
    "kind": "uint",
    "label": "@ 190-195A"
  },
  {
    "index": 102,
    "addr": 37038,
    "len": 2,
    "kind": "uint",
    "label": "@ 195-200A"
  },
  {
    "index": 103,
    "addr": 37040,
    "len": 2,
    "kind": "uint",
    "label": "@ 200A+"
  },
  {
    "index": 104,
    "addr": 37042,
    "len": 2,
    "kind": "uint",
    "label": "Charge started < 17V"
  },
  {
    "index": 105,
    "addr": 37044,
    "len": 2,
    "kind": "uint",
    "label": "Charge started 17-18V"
  },
  {
    "index": 106,
    "addr": 37046,
    "len": 2,
    "kind": "uint",
    "label": "Charge started 18-19V"
  },
  {
    "index": 107,
    "addr": 37048,
    "len": 2,
    "kind": "uint",
    "label": "Charge started 19-20V"
  },
  {
    "index": 108,
    "addr": 37050,
    "len": 2,
    "kind": "uint",
    "label": "Charge started 20V+"
  },
  {
    "index": 109,
    "addr": 37052,
    "len": 2,
    "kind": "uint",
    "label": "Charge ended < 17V"
  },
  {
    "index": 110,
    "addr": 37054,
    "len": 2,
    "kind": "uint",
    "label": "Charge ended 17-18V"
  },
  {
    "index": 111,
    "addr": 37056,
    "len": 2,
    "kind": "uint",
    "label": "Charge ended 18-19V"
  },
  {
    "index": 112,
    "addr": 37058,
    "len": 2,
    "kind": "uint",
    "label": "Charge ended 19-20V"
  },
  {
    "index": 113,
    "addr": 37060,
    "len": 2,
    "kind": "uint",
    "label": "Charge ended 20V+"
  },
  {
    "index": 114,
    "addr": 37062,
    "len": 2,
    "kind": "uint",
    "label": "Charge start temp -30C to -20C"
  },
  {
    "index": 115,
    "addr": 37064,
    "len": 2,
    "kind": "uint",
    "label": "Charge start temp -20C to -10C"
  },
  {
    "index": 116,
    "addr": 37066,
    "len": 2,
    "kind": "uint",
    "label": "Charge start temp -10C to 0C"
  },
  {
    "index": 117,
    "addr": 37068,
    "len": 2,
    "kind": "uint",
    "label": "Charge start temp 0C to +10C"
  },
  {
    "index": 118,
    "addr": 37070,
    "len": 2,
    "kind": "uint",
    "label": "Charge start temp +10C to +20C"
  },
  {
    "index": 119,
    "addr": 37072,
    "len": 2,
    "kind": "uint",
    "label": "Charge start temp +20C to +30C"
  },
  {
    "index": 120,
    "addr": 37074,
    "len": 2,
    "kind": "uint",
    "label": "Charge start temp +30C to +40C"
  },
  {
    "index": 121,
    "addr": 37076,
    "len": 2,
    "kind": "uint",
    "label": "Charge start temp +40C to +50C"
  },
  {
    "index": 122,
    "addr": 37078,
    "len": 2,
    "kind": "uint",
    "label": "Charge start temp +50C to +60C"
  },
  {
    "index": 123,
    "addr": 37080,
    "len": 2,
    "kind": "uint",
    "label": "Charge start temp +60C to +70C"
  },
  {
    "index": 124,
    "addr": 37082,
    "len": 2,
    "kind": "uint",
    "label": "Charge start temp +70C to +80C"
  },
  {
    "index": 125,
    "addr": 37084,
    "len": 2,
    "kind": "uint",
    "label": "Charge start temp +80C and over"
  },
  {
    "index": 126,
    "addr": 37086,
    "len": 2,
    "kind": "uint",
    "label": "Charge end temp -30C to -20C"
  },
  {
    "index": 127,
    "addr": 37088,
    "len": 2,
    "kind": "uint",
    "label": "Charge end temp -20C to -10C"
  },
  {
    "index": 128,
    "addr": 37090,
    "len": 2,
    "kind": "uint",
    "label": "Charge end temp -10C to 0C"
  },
  {
    "index": 129,
    "addr": 37092,
    "len": 2,
    "kind": "uint",
    "label": "Charge end temp 0C to +10C"
  },
  {
    "index": 130,
    "addr": 37094,
    "len": 2,
    "kind": "uint",
    "label": "Charge end temp +10C to +20C"
  },
  {
    "index": 131,
    "addr": 37096,
    "len": 2,
    "kind": "uint",
    "label": "Charge end temp +30C to +30C"
  },
  {
    "index": 132,
    "addr": 37098,
    "len": 2,
    "kind": "uint",
    "label": "Charge end temp +30C to +40C"
  },
  {
    "index": 133,
    "addr": 37100,
    "len": 2,
    "kind": "uint",
    "label": "Charge end temp +40C to +50C"
  },
  {
    "index": 134,
    "addr": 37102,
    "len": 2,
    "kind": "uint",
    "label": "Charge end temp +50C to +60C"
  },
  {
    "index": 135,
    "addr": 37104,
    "len": 2,
    "kind": "uint",
    "label": "Charge end temp +60C to +70C"
  },
  {
    "index": 136,
    "addr": 37106,
    "len": 2,
    "kind": "uint",
    "label": "Charge end temp +70C to +80C"
  },
  {
    "index": 137,
    "addr": 37108,
    "len": 2,
    "kind": "uint",
    "label": "Charge end temp +80C and over"
  },
  {
    "index": 138,
    "addr": 37110,
    "len": 2,
    "kind": "uint",
    "label": "Dumb charge time (00:00-14:33)"
  },
  {
    "index": 139,
    "addr": 37112,
    "len": 2,
    "kind": "uint",
    "label": "Dumb charge time (14:34-29:07)"
  },
  {
    "index": 140,
    "addr": 37114,
    "len": 2,
    "kind": "uint",
    "label": "Dumb charge time (29:08-43:41)"
  },
  {
    "index": 141,
    "addr": 37116,
    "len": 2,
    "kind": "uint",
    "label": "Dumb charge time (43:42-58:15)"
  },
  {
    "index": 142,
    "addr": 37118,
    "len": 2,
    "kind": "uint",
    "label": "Dumb charge time (58:16-1:12:49)"
  },
  {
    "index": 143,
    "addr": 37120,
    "len": 2,
    "kind": "uint",
    "label": "Dumb charge time (1:12:50-1:27:23)"
  },
  {
    "index": 144,
    "addr": 37122,
    "len": 2,
    "kind": "uint",
    "label": "Dumb charge time (1:27:24-1:41:57)"
  },
  {
    "index": 145,
    "addr": 37124,
    "len": 2,
    "kind": "uint",
    "label": "Dumb charge time (1:41:58-1:56:31)"
  },
  {
    "index": 146,
    "addr": 37126,
    "len": 2,
    "kind": "uint",
    "label": "Dumb charge time (1:56:32-2:11:05)"
  },
  {
    "index": 147,
    "addr": 37128,
    "len": 2,
    "kind": "uint",
    "label": "Dumb charge time (2:11:06-2:25:39)"
  },
  {
    "index": 148,
    "addr": 37130,
    "len": 2,
    "kind": "uint",
    "label": "Dumb charge time (2:25:40-2:40:13)"
  },
  {
    "index": 149,
    "addr": 37132,
    "len": 2,
    "kind": "uint",
    "label": "Dumb charge time (2:40:14-2:54:47)"
  },
  {
    "index": 150,
    "addr": 37134,
    "len": 2,
    "kind": "uint",
    "label": "Dumb charge time (2:54:48-3:09:21)"
  },
  {
    "index": 151,
    "addr": 37136,
    "len": 2,
    "kind": "uint",
    "label": "Dumb charge time (3:09:22-3:23:55)"
  },
  {
    "index": 152,
    "addr": 37138,
    "len": 2,
    "kind": "uint",
    "label": "Redlink charge time (00:00-17:03)"
  },
  {
    "index": 153,
    "addr": 37140,
    "len": 2,
    "kind": "uint",
    "label": "Redlink charge time (17:04-34:07)"
  },
  {
    "index": 154,
    "addr": 37142,
    "len": 2,
    "kind": "uint",
    "label": "Redlink charge time (34:08-51:11)"
  },
  {
    "index": 155,
    "addr": 37144,
    "len": 2,
    "kind": "uint",
    "label": "Redlink charge time (51:12-1:08:15)"
  },
  {
    "index": 156,
    "addr": 37146,
    "len": 2,
    "kind": "uint",
    "label": "Redlink charge time (1:08:16-1:25:19)"
  },
  {
    "index": 157,
    "addr": 37148,
    "len": 2,
    "kind": "uint",
    "label": "Redlink charge time (1:25:20-1:42:23)"
  },
  {
    "index": 158,
    "addr": 37150,
    "len": 2,
    "kind": "uint",
    "label": "Redlink charge time (1:42:24-1:59:27)"
  },
  {
    "index": 159,
    "addr": 37152,
    "len": 2,
    "kind": "uint",
    "label": "Redlink charge time (1:59:28-2:16:31)"
  },
  {
    "index": 160,
    "addr": 37154,
    "len": 2,
    "kind": "uint",
    "label": "Redlink charge time (2:16:32-2:33:35)"
  },
  {
    "index": 161,
    "addr": 37156,
    "len": 2,
    "kind": "uint",
    "label": "Redlink charge time (2:33:36-2:50:39)"
  },
  {
    "index": 162,
    "addr": 37158,
    "len": 2,
    "kind": "uint",
    "label": "Redlink charge time (2:50:40-3:07:43)"
  },
  {
    "index": 163,
    "addr": 37160,
    "len": 2,
    "kind": "uint",
    "label": "Redlink charge time (3:07:44-3:24:47)"
  },
  {
    "index": 164,
    "addr": 37162,
    "len": 2,
    "kind": "uint",
    "label": "Redlink charge time (3:24:48-3:41:51)"
  },
  {
    "index": 165,
    "addr": 37164,
    "len": 2,
    "kind": "uint",
    "label": "Redlink charge time (3:41:52-3:58:55)"
  },
  {
    "index": 166,
    "addr": 37166,
    "len": 2,
    "kind": "uint",
    "label": "Completed charge (?)"
  },
  {
    "index": 167,
    "addr": 37168,
    "len": 2,
    "kind": "uint",
    "label": "Unknown"
  },
  {
    "index": 168,
    "addr": 37170,
    "len": 2,
    "kind": "uint",
    "label": "Unknown"
  },
  {
    "index": 169,
    "addr": 37172,
    "len": 2,
    "kind": "uint",
    "label": "Unknown"
  },
  {
    "index": 170,
    "addr": 37174,
    "len": 2,
    "kind": "uint",
    "label": "Unknown"
  },
  {
    "index": 171,
    "addr": 37176,
    "len": 2,
    "kind": "uint",
    "label": "Unknown"
  },
  {
    "index": 172,
    "addr": 37178,
    "len": 2,
    "kind": "uint",
    "label": "Unknown"
  },
  {
    "index": 173,
    "addr": 37180,
    "len": 2,
    "kind": "uint",
    "label": "Unknown"
  },
  {
    "index": 174,
    "addr": 37182,
    "len": 2,
    "kind": "uint",
    "label": "Unknown"
  },
  {
    "index": 175,
    "addr": 37184,
    "len": 2,
    "kind": "uint",
    "label": "Unknown"
  },
  {
    "index": 176,
    "addr": 37186,
    "len": 2,
    "kind": "uint",
    "label": "Unknown histogram (temperature?)"
  },
  {
    "index": 177,
    "addr": 37188,
    "len": 2,
    "kind": "uint",
    "label": "Unknown histogram"
  },
  {
    "index": 178,
    "addr": 37190,
    "len": 2,
    "kind": "uint",
    "label": "Unknown histogram"
  },
  {
    "index": 179,
    "addr": 37192,
    "len": 2,
    "kind": "uint",
    "label": "Unknown histogram"
  },
  {
    "index": 180,
    "addr": 37194,
    "len": 2,
    "kind": "uint",
    "label": "Unknown histogram"
  },
  {
    "index": 181,
    "addr": 37196,
    "len": 2,
    "kind": "uint",
    "label": "Unknown histogram"
  },
  {
    "index": 182,
    "addr": 37198,
    "len": 2,
    "kind": "uint",
    "label": "Unknown histogram"
  },
  {
    "index": 183,
    "addr": 37200,
    "len": 2,
    "kind": "uint",
    "label": "Unknown histogram"
  }
];

export const MATRIX: MatrixBlock[] = [
  {
    "addr": 0,
    "len": 2
  },
  {
    "addr": 2,
    "len": 2
  },
  {
    "addr": 4,
    "len": 5
  },
  {
    "addr": 13,
    "len": 4
  },
  {
    "addr": 17,
    "len": 4
  },
  {
    "addr": 21,
    "len": 4
  },
  {
    "addr": 25,
    "len": 4
  },
  {
    "addr": 35,
    "len": 20
  },
  {
    "addr": 55,
    "len": 4
  },
  {
    "addr": 105,
    "len": 2
  },
  {
    "addr": 123,
    "len": 1
  },
  {
    "addr": 16384,
    "len": 4
  },
  {
    "addr": 16394,
    "len": 10
  },
  {
    "addr": 16404,
    "len": 2
  },
  {
    "addr": 16406,
    "len": 2
  },
  {
    "addr": 16409,
    "len": 2
  },
  {
    "addr": 16411,
    "len": 2
  },
  {
    "addr": 16413,
    "len": 2
  },
  {
    "addr": 16415,
    "len": 2
  },
  {
    "addr": 24576,
    "len": 2
  },
  {
    "addr": 24578,
    "len": 2
  },
  {
    "addr": 24580,
    "len": 4
  },
  {
    "addr": 24584,
    "len": 4
  },
  {
    "addr": 24588,
    "len": 2
  },
  {
    "addr": 36864,
    "len": 58
  },
  {
    "addr": 36922,
    "len": 58
  },
  {
    "addr": 36980,
    "len": 58
  },
  {
    "addr": 37038,
    "len": 58
  },
  {
    "addr": 37096,
    "len": 58
  },
  {
    "addr": 37154,
    "len": 48
  },
  {
    "addr": 37202,
    "len": 0
  },
  {
    "addr": 40960,
    "len": 6
  }
];

export type RegGroup =
  | "Identity"
  | "Live"
  | "Forge raw"
  | "Life stats"
  | "Discharge 10 A"
  | "Discharge 5 A"
  | "Charge voltage"
  | "Charge temperature"
  | "Dumb-charge time"
  | "Redlink time"
  | "Other";

export const GROUP_ORDER: RegGroup[] = [
  "Identity",
  "Live",
  "Forge raw",
  "Life stats",
  "Discharge 10 A",
  "Discharge 5 A",
  "Charge voltage",
  "Charge temperature",
  "Dumb-charge time",
  "Redlink time",
  "Other",
];

export function groupFor(addr: number): RegGroup {
  if (addr < 0x4000) return "Identity";
  if (addr < 0x6000) return "Live";
  if (addr < 0x9000) return "Forge raw";
  if (addr < 0x903a) return "Life stats";
  if (addr <= 0x9060) return "Discharge 10 A";
  if (addr <= 0x90b0) return "Discharge 5 A";
  if (addr <= 0x90c4) return "Charge voltage";
  if (addr <= 0x90f4) return "Charge temperature";
  if (addr <= 0x9110) return "Dumb-charge time";
  if (addr <= 0x912c) return "Redlink time";
  return "Other";
}

/** Same index list m.health() reads, in that order. */
export const HEALTH_INDEXES: number[] = [
  4, 28, 25, 26, 12, 13, 18, 29, 39, 40, 41, 42, 43, 33, 32, 31, 35, 36, 38,
  44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63,
  8, 2,
];
