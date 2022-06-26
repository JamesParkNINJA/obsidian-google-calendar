import type {
	GoogleCalander,
	GoogleEvent,
	GoogleEventList,
} from "../helper/types";
import type GoogleCalendarPlugin from "src/GoogleCalendarPlugin";
import { createNotice } from "src/helper/NoticeHelper";
import { getGoogleAuthToken } from "./GoogleAuth";

import { moment } from "obsidian";
import { googleListCalendars } from "./GoogleListCalendars";

export async function googleListEventsByCalendar(
	plugin: GoogleCalendarPlugin,
	googleCalander: GoogleCalander,
	date: string,
	endDate?: string
): Promise<GoogleEvent[]> {
	let totalEventList: GoogleEvent[] = [];
	let tmpRequestResult: GoogleEventList;
	const resultSizes = 2500;

	const requestHeaders: HeadersInit = new Headers();
	requestHeaders.append(
		"Authorization",
		"Bearer " + (await getGoogleAuthToken(plugin))
	);
	requestHeaders.append("Content-Type", "application/json");

	try {
		do {
			let requestUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
				googleCalander.id
			)}/events`;
			requestUrl += `?key=${plugin.settings.googleApiToken}`;
			requestUrl += `&maxResults=${resultSizes}`;
			requestUrl += `&singleEvents=True`;
			requestUrl += `&orderBy=startTime`;
			requestUrl += `&timeMin=${date}T00%3A00%3A00Z`;

			// TODO This could lead to problems displaying events at the wrong dates
			if (endDate) {
				requestUrl += `&timeMax=${endDate}T23%3A59%3A59Z`;
			} else {
				requestUrl += `&timeMax=${date}T23%3A59%3A59Z`;
			}

			if (tmpRequestResult && tmpRequestResult.nextPageToken) {
				requestUrl += `&nextPageToken=${tmpRequestResult.nextPageToken}`;
			}

			const response = await fetch(requestUrl, {
				method: "GET",
				headers: requestHeaders,
			});

			tmpRequestResult = await response.json();
			tmpRequestResult.items.forEach((event) => {
				event.parent = googleCalander;
			});

			const newList = tmpRequestResult.items.filter(
				(event) => event.status != "cancelled"
			);

			totalEventList = [...totalEventList, ...newList];
		} while (tmpRequestResult.items.length == 2500);

		totalEventList = totalEventList.sort((a:GoogleEvent, b:GoogleEvent) : number => {
            const startA = window.moment((a.start.date || a.start.dateTime))
            const startB = window.moment((b.start.date || b.start.dateTime))

            return startA.isBefore(startB, "minute") ? -1 : 1;
        })

		return totalEventList;
	} catch (error) {
		console.log(error);
		createNotice(plugin, "Could not load google events");
		return [];
	}
}

export async function googleListEvents(
	plugin: GoogleCalendarPlugin,
	date: string,
	endDate?: string
): Promise<GoogleEvent[]> {
	try {
		const calendarList = await googleListCalendars(plugin);
		let eventList: GoogleEvent[] = [];

		for (let i = 0; i < calendarList.length; i++) {
			const events = await googleListEventsByCalendar(
				plugin,
				calendarList[i],
				date,
				endDate
			);

			eventList = [...eventList, ...events];
		}

		eventList = eventList.sort((a:GoogleEvent, b:GoogleEvent) : number => {
            const startA = window.moment((a.start.date || a.start.dateTime))
            const startB = window.moment((b.start.date || b.start.dateTime))

            return startA.isBefore(startB, "minute") ? -1 : 1;
        })

		return eventList;
	} catch (error) {
		console.log(error);
		createNotice(plugin, "Could not load google events");
		return [];
	}
}

export async function googleListTodayEventsByCalendar(
	plugin: GoogleCalendarPlugin,
	googleCalander: GoogleCalander
): Promise<GoogleEvent[]> {
	const today = moment().format("YYYY-MM-DD");
	const list = await googleListEventsByCalendar(
		plugin,
		googleCalander,
		today
	);
	return list;
}

export async function googleListTodayEvents(
	plugin: GoogleCalendarPlugin
): Promise<GoogleEvent[]> {
	const today = moment().format("YYYY-MM-DD");
	const list = await googleListEvents(plugin, today);
	return list;
}

export async function googleListEventsByMonth(
	plugin: GoogleCalendarPlugin,
	dateInMonth: string
): Promise<GoogleEvent[]> {
	const monthStartDate = moment(dateInMonth)
		.startOf("month")
		.format("YYYY-MM-DD");
	const monthEndDate = moment(dateInMonth)
		.endOf("month")
		.format("YYYY-MM-DD");

	const list = await googleListEvents(plugin, monthStartDate, monthEndDate);
	return list;
}