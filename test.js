const test = require("ava")
const { promises: fs } = require("fs")
const path = require("path")
const del = require("del")
const sendanywhere = require("./lib/sendanywhere")

const TEST_DIRECTORY = "test-temp"
const API_KEY = process.env.SENDANYWHERE_API_KEY
const DEVICE_NAME = "Sendanywhere CLI Test"

test.after.always(async () => {
	await del(TEST_DIRECTORY)
})

test("main", async t => {
	if (!API_KEY) {
		console.log("Set the `SENDANYWHERE_API_KEY` environmental variable to test!")
		t.pass()
		return
	}

	const TEST_FILE = "fixture.txt"

	const { key } = await sendanywhere.send([TEST_FILE], { apiKey: API_KEY, deviceName: DEVICE_NAME })
	const { downloadRequest } = await sendanywhere.receive(key, { apiKey: API_KEY, deviceName: DEVICE_NAME, destination: TEST_DIRECTORY, filename: TEST_FILE })
	await downloadRequest
	t.is(await fs.readFile(path.join(TEST_DIRECTORY, TEST_FILE), "utf8"), "Hello World")
})
