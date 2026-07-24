function getWindow() {
    if (typeof window !== 'undefined') {
        return window;
    }
    throw new Error("Objeto 'window' global não encontrado");
}

function getDocument() {
    const win = getWindow();
    const { document } = win;
    if (!document) {
        throw new Error("Window não contém um 'document'");
    }
    return document;
}

export { getWindow, getDocument }