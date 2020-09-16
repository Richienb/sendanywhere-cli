#!/usr/bin/env node
"use strict"
const meow = require("meow")
const ora = require("ora")
const chalk = require("chalk")
const humanizeList = require("humanize-list")
const logSymbols = require("log-symbols")
const terminalLink = require("terminal-link")
const askText = require("ask-text")
const updateNotifier = require("update-notifier")
const Conf = require("conf")
const sendanywhere = require("./lib/sendanywhere")

const config = new Conf()

const { input, flags, pkg, showHelp } = meow(`
    Usage
      $ sendanywhere send <files...>
      $ sendanywhere receive <id>
      $ sendanywhere config

    Options
      --extract If a zip file was sent, attempt to extract it. Sending multiple files will result in a zip being created. Enabled by default.
	  --destination When receiving, download the content to the specified directory. Set to the current working directory by default.
	  --filename When receiving a single file, use the specified filename.

    Examples
      $ sendanywhere send file.png
      ${logSymbols.success} Key: ${chalk.bold.blueBright("123456")} - Finished uploading!

      $ sendanywhere receive 123456
      ${logSymbols.success} Finished downloading!
`, {
	flags: {
		extract: {
			type: "boolean",
			default: true
		},
		destination: {
			type: "string",
			default: process.cwd()
		},
		filename: {
			type: "string"
		}
	}
})

updateNotifier({ pkg }).notify()

const [action, ...targets] = input

const DEVICE_NAME = "Sendanywhere CLI"

module.exports = (async () => {
	if (action === "config" || !config.has("apiKey")) {
		config.set("apiKey", await askText(`Enter your ${chalk.blueBright("Sendanywhere")} ${terminalLink(chalk.blueBright("API key"), "https://send-anywhere.com/api")}: `))
	}

	const apiKey = config.get("apiKey")
	if (action === "send") {
		const spinner = ora(`Preparing to send ${humanizeList(targets.map(target => chalk.blueBright(target)))}`).start()
		const { key, progress } = await sendanywhere.send(targets, { apiKey, deviceName: DEVICE_NAME })
		progress.subscribe(({ percent }) => {
			if (percent < 0.001) {
				spinner.text = `Key: ${chalk.bold.blueBright(key)} - Waiting for receiver`
			} else {
				spinner.text = `Key: ${chalk.bold.blueBright(key)} - Uploading (${chalk.blueBright(`${Math.round(percent * 100)}%`)})`
			}
		}, error => {
			spinner.fail(`Failed to upload: ${error.message}`)
		}, () => {
			spinner.succeed(`Key: ${chalk.bold.blueBright(key)} - Finished uploading!`)
		})
	} else if (action === "receive") {
		const [key] = targets
		const spinner = ora(`Preparing to download ${chalk.bold.blueBright(key)}`).start()
		const { progress, downloadRequest } = await sendanywhere.receive(key, { apiKey, deviceName: DEVICE_NAME, extract: flags.extract, destination: flags.destination, filename: flags.filename })
		progress.subscribe(({ percent }) => {
			spinner.text = `Downloading ${chalk.bold.blueBright(key)} (${chalk.blueBright(`${Math.round(percent * 100)}%`)})`
		}, error => {
			spinner.fail(`Failed to download: ${error.message}`)
		}, async () => {
			spinner.text = "Finalizing download"
			await downloadRequest
			spinner.succeed("Finished downloading!")
		})
	} else {
		showHelp()
	}
})()
