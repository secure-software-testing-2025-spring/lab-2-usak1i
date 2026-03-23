const test = require("node:test");
const assert = require("assert");
const fs = require("fs");
const { Application, MailSystem } = require("./main");

test("MailSystem write", () => {
    const ms = new MailSystem();
    assert.strictEqual(ms.write("Alice"), "Congrats, Alice!");
});

test("MailSystem send success", (t) => {
    const ms = new MailSystem();
    t.mock.method(Math, "random", () => 0.9);
    assert.strictEqual(ms.send("Alice", "ctx"), true);
});

test("MailSystem send failure", (t) => {
    const ms = new MailSystem();
    t.mock.method(Math, "random", () => 0.1);
    assert.strictEqual(ms.send("Alice", "ctx"), false);
});

async function buildApp(t) {
    t.mock.method(Application.prototype, "getNames", async () => {
        return [["Alice", "Bob", "Charlie"], []];
    });
    const app = new Application();
    await app.getNames();
    return app;
}

test("Application getNames reads file", async (t) => {
    // Create a temporary name_list.txt for the real getNames to read
    fs.writeFileSync("name_list.txt", "Alice\nBob\nCharlie");
    try {
        const app = Object.create(Application.prototype);
        app.people = [];
        app.selected = [];
        app.mailSystem = new MailSystem();
        // Call the original getNames (not mocked)
        const [people, selected] =
            await Application.prototype.getNames.call(app);
        assert.deepStrictEqual(people, ["Alice", "Bob", "Charlie"]);
        assert.deepStrictEqual(selected, []);
    } finally {
        fs.unlinkSync("name_list.txt");
    }
});

test("Application selectNextPerson", async (t) => {
    const app = await buildApp(t);
    t.mock.method(Math, "random", () => 0.0);
    const person = app.selectNextPerson();
    assert.strictEqual(person, "Alice");
    assert.deepStrictEqual(app.selected, ["Alice"]);
});

test("Application selectNextPerson skips already selected", async (t) => {
    const app = await buildApp(t);
    app.selected = ["Alice"];
    let callCount = 0;
    t.mock.method(Math, "random", () => {
        // people = ['Alice','Bob','Charlie'], length 3
        // call 0: floor(0.0 * 3) = 0 → Alice (already selected)
        // call 1: floor(0.5 * 3) = 1 → Bob
        return callCount++ === 0 ? 0.0 : 0.5;
    });
    const person = app.selectNextPerson();
    assert.strictEqual(person, "Bob");
});

test("Application selectNextPerson returns null when all selected", async (t) => {
    const app = await buildApp(t);
    app.selected = ["Alice", "Bob", "Charlie"];
    assert.strictEqual(app.selectNextPerson(), null);
});

test("Application getRandomPerson", async (t) => {
    const app = await buildApp(t);
    t.mock.method(Math, "random", () => 0.5);
    assert.strictEqual(app.getRandomPerson(), "Bob");
});

test("Application notifySelected", async (t) => {
    const app = await buildApp(t);
    app.selected = ["Alice", "Bob"];
    t.mock.method(app.mailSystem, "write", (name) => "mocked context");
    t.mock.method(app.mailSystem, "send", (name, ctx) => true);
    app.notifySelected();
    assert.strictEqual(app.mailSystem.write.mock.calls.length, 2);
    assert.strictEqual(app.mailSystem.send.mock.calls.length, 2);
});
