"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
module.exports = function (bot) {
    class Category extends bot.page {
        /**
         * @constructor
         * @param {string} name - name of the category
         */
        constructor(name) {
            super(name, 14);
            if (this.namespace !== 14) {
                throw new Error('not a category page');
            }
        }
        // TODO: Add recursive modes
        /**
         * Get all members in the category - this includes subcategories, pages and files
         * @param {Object} options - additional API parameters
         * @returns {Promise<Object[]>} - Resolved with array of objects of form
         * { pageid: 324234, ns: 0, title: 'Main Page' }
         */
        members(options) {
            return bot.request({
                "action": "query",
                "list": "categorymembers",
                "cmtitle": "Category:" + this.title,
                "cmlimit": "max",
                ...options
            }).then(data => data.query.categorymembers);
        }
        /**
         * Get all pages in the category - does not include subcategories or files
         * @param {Object} options - additional API parameters
         * @returns {Promise<Object[]>} - Resolved with array of objects of form
         * { pageid: 324234, ns: 0, title: 'Main Page' }
         */
        pages(options) {
            return bot.request({
                "action": "query",
                "list": "categorymembers",
                "cmtitle": "Category:" + this.title,
                "cmtype": "page",
                "cmlimit": "max",
                ...options
            }).then(data => data.query.categorymembers);
        }
        /**
         * Get all subcategories of the category
         * @param {Object} options - additional API parameters
         * @returns {Promise<Object[]>} - Resolved with array of objects of form
         * { pageid: 324234, ns: 14, title: 'Category:Living people' }
         */
        subcats(options) {
            return bot.request({
                "action": "query",
                "list": "categorymembers",
                "cmtitle": "Category:" + this.title,
                "cmtype": "subcat",
                "cmlimit": "max",
                ...options
            }).then(data => data.query.categorymembers);
        }
        /**
         * Get all files in the category
         * @param {Object} options - additional API parameters
         * @returns {Promise<Object[]>} - Resolved with array of objects of form
         * { pageid: 324234, ns: 6, title: 'File:Image.jpg' }
         */
        files(options) {
            return bot.request({
                "action": "query",
                "list": "categorymembers",
                "cmtitle": "Category:" + this.title,
                "cmtype": "file",
                "cmlimit": "max",
                ...options
            }).then(data => data.query.categorymembers);
        }
    }
    return Category;
};