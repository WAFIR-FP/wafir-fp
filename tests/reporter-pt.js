import { spec } from 'node:test/reporters';
import { Readable } from 'node:stream';

const summaryTranslations = [
    [/^ℹ tests /gm, 'ℹ testes '],
    [/^ℹ suites /gm, 'ℹ suítes '],
    [/^ℹ pass /gm, 'ℹ aprovados '],
    [/^ℹ fail /gm, 'ℹ reprovados '],
    [/^ℹ cancelled /gm, 'ℹ cancelados '],
    [/^ℹ skipped /gm, 'ℹ ignorados '],
    [/^ℹ todo /gm, 'ℹ pendentes '],
    [/^ℹ duration_ms /gm, 'ℹ duração_ms ']
];

const translateSummary = output => summaryTranslations.reduce(
    (translated, [pattern, replacement]) => translated.replace(pattern, replacement),
    output
);

export default async function* portugueseReporter(source) {
    const formattedOutput = Readable.from(source).compose(new spec());
    for await (const chunk of formattedOutput) {
        yield translateSummary(String(chunk));
    }
}
