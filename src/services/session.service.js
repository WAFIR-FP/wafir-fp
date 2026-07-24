// As sessões existem apenas durante o processo atual.
const sessions = new Map();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const pruneExpiredSessions = () => {
    const now = Date.now();
    for (const [token, session] of sessions) {
        if (now - session.createdAt > SESSION_TTL_MS) sessions.delete(token);
    }
};

const createSession = (token, data) => {
    pruneExpiredSessions();
    sessions.set(token, {
        ...data,
        createdAt: Date.now()
    });
};

const getSession = (token) => {
    const session = sessions.get(token);
    if (session) {
        // Remove sessões com mais de 24 horas.
        const age = Date.now() - session.createdAt;
        if (age > SESSION_TTL_MS) {
            sessions.delete(token);
            return null;
        }
        return session;
    }
    return null;
};

const deleteSession = (token) => {
    sessions.delete(token);
};

export { createSession, getSession, deleteSession };
