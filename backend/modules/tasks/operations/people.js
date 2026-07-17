const { Person } = require('../../../models');

/**
 * Link a task to people (many-to-many, parity with tags).
 * Accepts an array of { uid?, name } objects. People are matched by uid first,
 * then by name (case-sensitive on the unique [user_id, name] index); missing
 * ones are auto-created, mirroring the #tag auto-create behavior.
 */
async function updateTaskPeople(task, peopleData, userId, options = {}) {
    const { transaction } = options;
    if (!peopleData) return;

    if (!Array.isArray(peopleData) || peopleData.length === 0) {
        await task.setInvolvedPeople([], { transaction });
        return;
    }

    const resolved = [];
    const seen = new Set();

    for (const entry of peopleData) {
        const uid = entry && entry.uid ? String(entry.uid).trim() : null;
        const name = entry && entry.name ? String(entry.name).trim() : null;

        if (!uid && !name) continue;

        let person = null;
        if (uid) {
            person = await Person.findOne({
                where: { uid, user_id: userId },
                transaction,
            });
        }
        if (!person && name) {
            person = await Person.findOne({
                where: { name, user_id: userId },
                transaction,
            });
        }
        if (!person && name) {
            person = await Person.create(
                { name, user_id: userId },
                { transaction }
            );
        }

        if (person && !seen.has(person.id)) {
            seen.add(person.id);
            resolved.push(person);
        }
    }

    await task.setInvolvedPeople(resolved, { transaction });
}

module.exports = {
    updateTaskPeople,
};
