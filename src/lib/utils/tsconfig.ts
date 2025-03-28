import ts from "typescript";
import { isDir, isFile, readFile } from "./fs.js";
import { createRequire } from "module";
import type { Logger } from "#utils";
import { diagnostic, diagnostics } from "./loggers.js";

export function findTsConfigFile(
    path: string,
    usedFile?: (path: string) => void,
): string | undefined {
    let fileToRead: string | undefined = path;
    if (isDir(fileToRead)) {
        fileToRead = ts.findConfigFile(
            path,
            (file) => (usedFile?.(file), isFile(file)),
        );
    }

    if (!fileToRead || !isFile(fileToRead)) {
        return;
    }

    return fileToRead;
}

// We don't need recursive read checks because that would cause a diagnostic
// when reading the tsconfig for compiler options, which happens first, and we bail before
// doing this in that case.
export function getTypeDocOptionsFromTsConfig(file: string): any {
    const readResult = ts.readConfigFile(file, readFile);

    const result = {};

    if (readResult.error) {
        return result;
    }

    if ("extends" in readResult.config) {
        const resolver = createRequire(file);
        const extended = Array.isArray(readResult.config.extends)
            ? readResult.config.extends.map(String)
            : [String(readResult.config.extends)];

        for (const extendedFile of extended) {
            let resolvedParent: string;
            try {
                resolvedParent = resolver.resolve(extendedFile);
            } catch {
                continue;
            }
            Object.assign(
                result,
                getTypeDocOptionsFromTsConfig(resolvedParent),
            );
        }
    }

    if ("typedocOptions" in readResult.config) {
        Object.assign(result, readResult.config.typedocOptions);
    }

    return result;
}

const tsConfigCache: Record<string, ts.ParsedCommandLine | undefined> = {};

export function readTsConfig(
    path: string,
    logger: Logger,
): ts.ParsedCommandLine | undefined {
    if (tsConfigCache[path]) {
        return tsConfigCache[path];
    }

    const parsed = ts.getParsedCommandLineOfConfigFile(
        path,
        {},
        {
            ...ts.sys,
            onUnRecoverableConfigFileDiagnostic: diagnostic.bind(null, logger),
        },
    );

    if (!parsed) {
        return;
    }

    diagnostics(logger, parsed.errors);

    tsConfigCache[path] = parsed;
    return parsed;
}
