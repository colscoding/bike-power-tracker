#!/usr/bin/env tsx

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface AnyUsage {
    file: string;
    line: number;
    context: string;
    category: 'explicit' | 'implicit' | 'assertion';
}

/**
 * Find all `any` type usages in the codebase
 */
function findAnyUsages(): AnyUsage[] {
    // Run grep from packages/client root
    try {
        const result = execSync(
            `grep -rn ": any" src/ --include="*.ts" --include="*.tsx" || true`,
            { encoding: 'utf-8', cwd: path.resolve(__dirname, '..') }
        );

        const usages: AnyUsage[] = [];

        for (const line of result.split('\n').filter(Boolean)) {
            const match = line.match(/^(.+):(\d+):(.+)$/);
            if (match) {
                usages.push({
                    file: match[1],
                    line: parseInt(match[2], 10),
                    context: match[3].trim(),
                    category: categorize(match[3]),
                });
            }
        }

        // Also check for 'as any' assertions
        const resultAsAny = execSync(
            `grep -rn "as any" src/ --include="*.ts" --include="*.tsx" || true`,
            { encoding: 'utf-8', cwd: path.resolve(__dirname, '..') }
        );

        for (const line of resultAsAny.split('\n').filter(Boolean)) {
            const match = line.match(/^(.+):(\d+):(.+)$/);
            if (match) {
                // Avoid duplicates if a line has both (unlikely but possible)
                if (!usages.some(u => u.file === match[1] && u.line === parseInt(match[2], 10))) {
                    usages.push({
                        file: match[1],
                        line: parseInt(match[2], 10),
                        context: match[3].trim(),
                        category: 'assertion',
                    });
                }
            }
        }

        return usages;
    } catch (e) {
        console.error('Error running grep:', e);
        return [];
    }
}

function categorize(context: string): AnyUsage['category'] {
    if (context.includes('as any')) return 'assertion';
    if (context.includes(': any')) return 'explicit';
    return 'implicit';
}

const usages = findAnyUsages();
console.log(`Found ${usages.length} 'any' usages:`);
console.log(`  Explicit: ${usages.filter(u => u.category === 'explicit').length}`);
console.log(`  Assertions: ${usages.filter(u => u.category === 'assertion').length}`);
console.log(`  Implicit: ${usages.filter(u => u.category === 'implicit').length}`);

// Group by file
const byFile = new Map<string, AnyUsage[]>();
for (const usage of usages) {
    const existing = byFile.get(usage.file) || [];
    existing.push(usage);
    byFile.set(usage.file, existing);
}

console.log('\nBy file:');
for (const [file, fileUsages] of byFile) {
    console.log(`  ${file}: ${fileUsages.length}`);
}
