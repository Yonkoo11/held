// Where this process keeps the files it owns. One definition, imported by everything that writes.
//
// It used to be two lines copied into four modules, and copies drift: fixing the absolute-path case
// in the job store left the evidence trail and the escrow ledger still joining an absolute path
// onto the working directory. A deployment mounted a volume at /app/data and the evidence file
// landed in /app/app/data, which exists, is writable, and is the wrong place. Nothing errors.
import path from 'node:path';

const raw = process.env.DATA_DIR || 'data';
export const DATA_DIR = path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
export const inData = (name) => path.join(DATA_DIR, name);
