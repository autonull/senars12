const fs = require('fs');
let code = fs.readFileSync('src/nar/terms/truth.ts', 'utf8');

const brandTypes = `
export type Frequency = number & { readonly __brand: unique symbol };
export type Confidence = number & { readonly __brand: unique symbol };
`;

code = code.replace("export interface Truth {", brandTypes + "\nexport interface Truth {\n");
code = code.replace("readonly f: number;", "readonly f: Frequency;");
code = code.replace("readonly c: number;", "readonly c: Confidence;");

code = code.replace("return Object.freeze({f: clamp(isNaN(f) ? 0.5 : f, 0, 1), c: clampedC});", "return Object.freeze({f: clamp(isNaN(f) ? 0.5 : f, 0, 1) as Frequency, c: clampedC as Confidence});");

code = code.replace(/f: 1\.0, c: 0\.9/g, "f: 1.0 as Frequency, c: 0.9 as Confidence");
code = code.replace(/f: 0\.0, c: 0\.9/g, "f: 0.0 as Frequency, c: 0.9 as Confidence");
code = code.replace(/f: 0\.5, c: 0\.9/g, "f: 0.5 as Frequency, c: 0.9 as Confidence");


fs.writeFileSync('src/nar/terms/truth.ts', code);
