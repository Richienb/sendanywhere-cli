"use strict"
const fs = require("fs")
const got = require("got")
const { Observable } = require("rxjs")
const { CookieJar } = require("tough-cookie")
const FormData = require("form-data")
const pMap = require("p-map")
const jqueryParam = require("jquery-param")
const download = require("download")

const BASE_URL = "https://send-anywhere.com/web/v1/"

async function setDeviceCookie({ deviceName, cookieJar, apiKey }) {
	await got("device", {
		prefixUrl: BASE_URL,
		cookieJar,
		searchParams: {
			/* eslint-disable camelcase */
			profile_name: deviceName,
			api_key: apiKey
			/* eslint-enable camelcase */
		},
		responseType: "json"
	})
}

exports.send = async (files, { apiKey, deviceName }) => {
	const fileData = await pMap(files, async filepath => {
		const { size } = await fs.promises.stat(filepath)
		return { name: filepath, size }
	})

	const cookieJar = new CookieJar()
	await setDeviceCookie({ deviceName, cookieJar, apiKey })

	const { body: keyResult } = await got("key", {
		prefixUrl: BASE_URL,
		cookieJar,
		searchParams: jqueryParam({
			/* eslint-disable camelcase */
			file: fileData,
			api_key: apiKey
			/* eslint-enable camelcase */
		}),
		responseType: "json"
	})
	const { key, weblink: uploadUrl } = keyResult

	const formData = new FormData()

	files.forEach((filepath, index) => {
		formData.append(`file${index}`, fs.createReadStream(filepath), filepath)
	})

	const uploadRequest = got.stream(uploadUrl, {
		method: "post",
		body: formData
	}).on("uploadProgress", ({ percent }) => {
		if (percent === 1) {
			uploadRequest.destroy()
		}
	})

	return {
		key,
		progress: new Observable(observer => {
			if (uploadRequest.uploadProgress.percent === 1) {
				observer.next(uploadRequest.uploadProgress)
				observer.complete()
			}

			uploadRequest.on("uploadProgress", data => {
				observer.next(data)
				if (data.percent === 1) {
					observer.complete()
				}
			})
		})
	}
}

exports.receive = async (key, { apiKey, deviceName, extract, destination, filename }) => {
	const cookieJar = new CookieJar()
	await setDeviceCookie({ deviceName, cookieJar, apiKey })

	const { body } = await got(`key/${key}`, {
		cookieJar,
		prefixUrl: BASE_URL,
		searchParams: {
			/* eslint-disable camelcase */
			api_key: apiKey
			/* eslint-enable camelcase */
		},
		responseType: "json"
	})
	const { weblink: downloadUrl } = body

	const downloadRequest = download(downloadUrl, destination, { extract, filename })

	return {
		progress: new Observable(observer => {
			downloadRequest.on("downloadProgress", data => {
				observer.next(data)
				if (data.percent === 1) {
					observer.complete()
				}
			})
		}),
		downloadRequest
	}
}
