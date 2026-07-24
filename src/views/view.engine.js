import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatesDir = path.join(__dirname, 'templates');
const templateCache = new Map();

const getTemplateValue = (data, key) => {
    return key.split('.').reduce((acc, part) => {
        if (acc && Object.prototype.hasOwnProperty.call(acc, part)) {
            return acc[part];
        }
        return undefined;
    }, data);
};

const loadTemplate = async (name) => {
    if (templateCache.has(name)) {
        return templateCache.get(name);
    }

    const filePath = path.join(templatesDir, `${name}.html`);
    const template = await fs.readFile(filePath, 'utf-8');
    templateCache.set(name, template);
    return template;
};

const renderTemplate = async (name, data = {}) => {
    const template = await loadTemplate(name);
    return template.replace(/{{\s*([a-zA-Z0-9_.]+)\s*}}/g, (_, key) => {
        const value = getTemplateValue(data, key);
        return value === undefined || value === null ? '' : String(value);
    });
};

export { renderTemplate };
