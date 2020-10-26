import {mwn, Title, Page} from '../../src/bot';
import loginCredentials = require('../mocking/loginCredentials');

import {expect} from 'chai';
import 'mocha';

describe('typescript', async function () {
	this.timeout(5000);
	let bot: mwn;

	before(function () {
		bot = new mwn({
			silent: true,
			...loginCredentials.account1_oauth,
			userAgent: 'mwn (https://github.com/siddharthvp/mwn)'
		});
		return bot.getTokensAndSiteInfo();
	});

	it('works with typescript', function () {
		expect(bot).to.be instanceof(mwn);
		return bot.request({action: 'query'}).then(data => {
			expect(data).to.have.key('batchcomplete');
			expect(data.batchcomplete).to.equal(true);
		});
	});

	it('nested classes work too with typescript', function () {
		let page = new bot.page('Main Page');
		expect(page.getNamespaceId()).to.equal(0);

		let date = new bot.date('20200101130042');
		expect(date.format('YYYY-MM-DD')).to.equal('2020-01-01');
		expect(date.getDate()).to.equal(1);

	});

});

