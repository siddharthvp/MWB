import {MwnError} from "./error";

import type {mwn, MwnTitle} from './bot';
import type {
	ApiDeleteParams, ApiEditPageParams, ApiMoveParams, ApiPurgeParams,
	ApiQueryAllPagesParams, ApiQueryLogEventsParams, ApiQueryRevisionsParams,
	ApiUndeleteParams, WikibaseClientApiDescriptionParams
} from "./api_params";
import type {LogEvent} from "./user";

export type revisionprop = "content" | "timestamp" | "user" | "comment" | "parsedcomment" |
	"ids" | "flags" | "size"  | "tags" | "userid" | "contentmodel";
export type logprop =  "type" | "user" | "comment" | "details" | "timestamp" | "title" |
	"parsedcomment" | "ids" | "tags" | "userid";

export interface ApiPage {
	pageid: number
	ns: number
	title: string
	missing?: true
	invalid?: true
	revisions?: ApiRevision[]
}

// If rvslots is not used revisions slot info is part of revision object
export interface ApiRevision extends ApiRevisionSlot {
	revid?: number
	parentid?: number
	minor?: boolean
	userhidden?: true
	anon?: true
	user?: string
	userid?: number
	timestamp?: string
	roles?: string[]
	commenthidden?: true
	comment?: string
	parsedcomment?: string
	slots?: {
		main: ApiRevisionSlot
		[slotname: string]: ApiRevisionSlot
	}
}

export interface ApiRevisionSlot {
	size?: number
	sha1?: string
	contentmodel?: string
	contentformat?: string
	content?: string
}

export interface MwnPageStatic {
	new (title: MwnTitle | string, namespace?: number): MwnPage;
}

export interface MwnPage extends MwnTitle {
	data: any;
	getTalkPage(): MwnPage;
	getSubjectPage(): MwnPage;
	text(): Promise<string>;
	categories(): Promise<{
		sortkey: string;
		category: string;
		hidden: boolean;
	}[]>;
	templates(): Promise<{
		ns: number;
		title: string;
		exists: boolean;
	}[]>;
	links(): Promise<{
		ns: number;
		title: string;
		exists: boolean;
	}[]>;
	backlinks(): Promise<string[]>;
	transclusions(): Promise<string[]>;
	images(): Promise<string[]>;
	externallinks(): Promise<string[]>;
	subpages(options?: ApiQueryAllPagesParams): Promise<string[]>;
	isRedirect(): Promise<boolean>;
	getRedirectTarget(): Promise<string>;
	getCreator(): Promise<string>;
	getDeletingAdmin(): Promise<string>;
	getDescription(customOptions?: any): Promise<string>;
	history(props: revisionprop[] | revisionprop, limit: number, customOptions?: ApiQueryRevisionsParams): Promise<ApiRevision[]>;
	historyGen(props: revisionprop[] | revisionprop, customOptions?: ApiQueryRevisionsParams): AsyncGenerator<ApiRevision>;
	logs(props: logprop | logprop[], limit?: number, type?: string, customOptions?: ApiQueryLogEventsParams): Promise<LogEvent[]>;
	logsGen(props: logprop | logprop[], type?: string, customOptions?: ApiQueryLogEventsParams): AsyncGenerator<LogEvent>
	edit(transform: ((rev: {
		content: string;
		timestamp: string;
	}) => string | ApiEditPageParams)): Promise<any>;
	save(text: string, summary?: string, options?: ApiEditPageParams): Promise<any>;
	newSection(header: string, message: string, additionalParams?: ApiEditPageParams): Promise<any>;
	move(target: string, summary: string, options?: ApiMoveParams): Promise<any>;
	delete(summary: string, options?: ApiDeleteParams): Promise<any>;
	undelete(summary: string, options?: ApiUndeleteParams): Promise<any>;
	purge(options?: ApiPurgeParams): Promise<any>;
}

export default function(bot: mwn): MwnPageStatic {

	class Page extends bot.title implements MwnPage {
		data: any

		constructor(title: MwnTitle | string, namespace?: number) {
			// bot property is set by mwn#page() method
			if (title instanceof bot.title) {
				super(title.title, title.namespace);
			} else {
				super(title, namespace);
			}
			this.data = {};
		}

		/**
		 * @override
		 */
		getTalkPage(): Page {
			return new Page(super.getTalkPage());
		}

		/**
		 * @override
		 */
		getSubjectPage(): Page {
			return new Page(super.getSubjectPage());
		}

		/**** Get operations *****/

		/**
		 * Get page wikitext
		 */
		text(): Promise<string> {
			return bot.request({
				"action": "parse",
				"page": this.toString(),
				"prop": "wikitext"
			}).then(data => {
				this.data.text = data.parse.wikitext;
				return data.parse.wikitext;
			});
		}

		/**
		 * Get page categories
		 * @returns {Promise<Object[]>} Resolved with array of objects like
		 * { sortkey: '...', category: '...', hidden: true }
		 */
		categories(): Promise<{sortkey: string, category: string, hidden: boolean}[]> {
			return bot.request({
				"action": "parse",
				"page": this.toString(),
				"prop": "categories"
			}).then(data => data.parse.categories);
		}

		/**
		 * Get templates transcluded on the page
		 * @returns {Promise<Object[]>} Resolved with array of objects like
		 * { ns: 10, title: 'Template:Cite web', exists: true }
		 */
		templates(): Promise<{ns: number, title: string, exists: boolean}[]> {
			return bot.request({
				"action": "parse",
				"page": this.toString(),
				"prop": "templates"
			}).then(data => data.parse.templates);
		}

		/**
		 * Get links on the page
		 * @returns {Promise<Object[]>} Resolved with array of objects like
		 * { ns: 0, title: 'Main Page', exists: true }
		 */
		links(): Promise<{ns: number, title: string, exists: boolean}[]> {
			return bot.request({
				"action": "parse",
				"page": this.toString(),
				"prop": "links"
			}).then(data => data.parse.links);
		}


		/**
		 * Get list of pages linking to this page
		 * @returns {Promise<String[]>}
		 */
		backlinks(): Promise<string[]> {
			return bot.continuedQuery({
				"action": "query",
				"prop": "linkshere",
				"titles": this.toString(),
				"lhprop": "title",
				"lhlimit": "max"
			}).then(jsons => {
				let pages = jsons.reduce((pages, json) => pages.concat(json.query.pages), []);
				let page = pages[0];
				if (page.missing) {
					return Promise.reject(new MwnError.MissingPage());
				}
				return page.linkshere.map((pg: ApiPage) => pg.title);
			});
		}

		/**
		 * Get list of pages transcluding this page
		 * @returns {Promise<String[]>}
		 */
		transclusions(): Promise<string[]> {
			return bot.continuedQuery({
				"action": "query",
				"prop": "transcludedin",
				"titles": this.toString(),
				"tiprop": "title",
				"tilimit": "max"
			}).then(jsons => {
				let pages = jsons.reduce((pages, json) => pages.concat(json.query.pages), []);
				let page = pages[0];
				if (page.missing) {
					return Promise.reject(new MwnError.MissingPage());
				}
				return page.transcludedin.map((pg: ApiPage) => pg.title);
			});
		}


		/**
		 * Returns list of images on the page
		 * @returns {Promise<String[]>} - array elements don't include File: prefix
		 */
		images(): Promise<string[]> {
			return bot.request({
				"action": "parse",
				"page": this.toString(),
				"prop": "images"
			}).then(data => data.parse.images);
		}

		/**
		 * Returns list of external links on the page
		 * @returns {Promise<String[]>}
		 */
		externallinks(): Promise<string[]> {
			return bot.request({
				"action": "parse",
				"page": this.toString(),
				"prop": "externallinks"
			}).then(data => data.parse.externallinks);
		}

		/**
		 * Returns list of subpages of the page
		 * @returns {Promise<String[]>}
		 */
		subpages(options?: ApiQueryAllPagesParams): Promise<string[]> {
			return bot.request({
				"action": "query",
				"list": "allpages",
				"apprefix": this.title + '/',
				"apnamespace": this.namespace,
				"aplimit": "max",
				...options
			}).then((data) => {
				return data.query.allpages.map((pg: ApiPage) => pg.title);
			});
		}

		/**
		 * Check if page is redirect or not
		 * @returns {Promise<boolean>}
		 */
		isRedirect(): Promise<boolean> {
			return this.getRedirectTarget().then(target => {
				return this.toText() !== target;
			});
		}

		/**
		 * Get redirect target.
		 * Returns the same page name if the page is not a redirect.
		 * @returns {Promise<string>}
		 */
		getRedirectTarget(): Promise<string> {
			if (this.data.text) {
				let target = /^\s*#redirect \[\[(.*?)\]\]/.exec(this.data.text);
				if (!target) {
					return Promise.resolve(this.toText());
				}
				return Promise.resolve(new bot.title(target[1]).toText());
			}
			return bot.request({
				action: 'query',
				titles: this.toString(),
				redirects: '1',
			}).then(data => {
				let page = data.query.pages[0];
				if (page.missing) {
					return Promise.reject(new MwnError.MissingPage());
				}
				return page.title;
			});
		}


		/**
		 * Get username of the page creator
		 * @returns {Promise<string>}
		 */
		getCreator(): Promise<string> {
			return bot.request({
				action: 'query',
				titles: this.toString(),
				prop: 'revisions',
				rvprop: 'user',
				rvlimit: 1,
				rvdir: 'newer'
			}).then(data => {
				let page = data.query.pages[0];
				if (page.missing) {
					return Promise.reject(new MwnError.MissingPage());
				}
				return page.revisions[0].user;
			});
		}

		/**
		 * Get username of the last deleting admin (or null)
		 * @returns {Promise<string>}
		 */
		getDeletingAdmin(): Promise<string> {
			return bot.request({
				action: "query",
				list: "logevents",
				leaction: "delete/delete",
				letitle: this.toString(),
				lelimit: 1
			}).then(data => {
				let logs = data.query.logevents;
				if (logs.length === 0) {
					return null;
				}
				return logs[0].user;
			});
		}

		/**
		 * Get short description, either the local one (for English Wikipedia)
		 * or the one from wikidata.
		 * @param {Object} customOptions
		 * @returns {Promise<string>}
		 */
		getDescription(customOptions: WikibaseClientApiDescriptionParams) { // ApiParams
			return bot.request({
				action: 'query',
				prop: 'description',
				titles: this.toString(),
				...customOptions
			}).then(data => {
				let page = data.query.pages[0];
				if (page.missing) {
					return Promise.reject(new MwnError.MissingPage());
				}
				return data.query.pages[0].description;
			});
		}

		/**
		 * Get the edit history of the page
		 * @param {revisionprop[]} props - revision properties to fetch, by default content is
		 * excluded
		 * @param {number} [limit=50] - number of revisions to fetch data about
		 * @param {Object} customOptions - custom API options
		 * @returns {Promise<Object[]>} - resolved with array of objects representing
		 * revisions, eg. { revid: 951809097, parentid: 951809097, timestamp:
		 * "2020-04-19T00:45:35Z", comment: "Edit summary" }
		 */
		history(props: revisionprop[] | revisionprop, limit = 50, customOptions?: ApiQueryRevisionsParams): Promise<ApiRevision[]> {
			return bot.request({
				"action": "query",
				"prop": "revisions",
				"titles": this.toString(),
				"rvprop": props || "ids|timestamp|flags|comment|user",
				"rvlimit": limit || 50,
				...customOptions
			}).then(data => {
				let page = data.query.pages[0];
				if (page.missing) {
					return Promise.reject(new MwnError.MissingPage());
				}
				return data.query.pages[0].revisions;
			});
		}

		async *historyGen(props: revisionprop[] | revisionprop, customOptions?: ApiQueryRevisionsParams): AsyncGenerator<ApiRevision> {
			let continuedQuery = bot.continuedQueryGen({
				"action": "query",
				"prop": "revisions",
				"titles": this.toString(),
				"rvprop": props || "ids|timestamp|flags|comment|user",
				"rvlimit": 50,
				...customOptions
			});
			for await (let json of continuedQuery) {
				for (let edit of json.query.pages[0].revisions) {
					yield edit;
				}
			}
		}

		/**
		 * Get the page logs.
		 * @param {logprop[]} props - data about log entries to fetch
		 * @param {number} limit - max number of log entries to fetch
		 * @param {string} type - type of log to fetch, can either be an letype or leaction
		 * Leave undefined (or null) to fetch all log types
		 * @param {Object} customOptions
		 * @returns {Promise<Object[]>} - resolved with array of objects representing
		 * log entries, eg. { ns: '0', title: 'Main Page', type: 'delete', user: 'Example',
		 * action: 'revision', timestamp: '2020-05-05T17:13:34Z', comment: 'edit summary' }
		 */
		logs(props: logprop | logprop[], limit?: number, type?: string, customOptions?: ApiQueryLogEventsParams): Promise<LogEvent[]> {
			let logtypeObj: ApiQueryLogEventsParams = {};
			if (type) {
				logtypeObj = { [type.includes('/') ? "leaction" : "letype"]: type };
			}
			return bot.request({
				"action": "query",
				"list": "logevents",
				...logtypeObj,
				"leprop": props || "title|type|user|timestamp|comment",
				"letitle": this.toString(),
				"lelimit": limit || 50,
				...customOptions
			}).then(data => {
				return data.query.logevents;
			});
		}

		async *logsGen(props: logprop | logprop[], type?: string, customOptions?: ApiQueryLogEventsParams): AsyncGenerator<LogEvent> {
			let logtypeObj: ApiQueryLogEventsParams = {};
			if (type) {
				logtypeObj = { [type.includes('/') ? "leaction" : "letype"]: type };
			}
			let continuedQuery = bot.continuedQueryGen({
				"action": "query",
				"list": "logevents",
				...logtypeObj,
				"leprop": props || "title|type|user|timestamp|comment",
				"letitle": this.toString(),
				"lelimit": 50,
				...customOptions
			});
			for await (let json of continuedQuery) {
				for (let event of json.query.logevents) {
					yield event;
				}
			}
		}


		/**** Post operations *****/
		// Defined in bot.js

		edit(transform: ((rev: {content: string, timestamp: string}) => string | ApiEditPageParams)) {
			return bot.edit(this.toString(), transform);
		}

		save(text: string, summary?: string, options?: ApiEditPageParams) {
			return bot.save(this.toString(), text, summary, options);
		}

		newSection(header: string, message: string, additionalParams?: ApiEditPageParams) {
			return bot.newSection(this.toString(), header, message, additionalParams);
		}

		move(target: string, summary: string, options?: ApiMoveParams) {
			return bot.move(this.toString(), target, summary, options);
		}

		delete(summary: string, options?: ApiDeleteParams) {
			return bot.delete(this.toString(), summary, options);
		}

		undelete(summary: string, options?: ApiUndeleteParams) {
			return bot.undelete(this.toString(), summary, options);
		}

		purge(options?: ApiPurgeParams) {
			return bot.purge(this.toString(), options);
		}

	}

	return Page as MwnPageStatic;

}
