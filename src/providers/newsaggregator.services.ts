import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import * as XML from 'pixl-xml';
import { Events } from 'ionic-angular';


import {Observable} from 'rxjs/Observable'
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/mergeAll';
import 'rxjs/add/operator/concatAll';
import 'rxjs/add/observable/from';
import 'rxjs/add/operator/timeout';
import 'rxjs/add/operator/catch';
import 'rxjs/add/operator/do';
import 'rxjs/add/operator/mergeMap';
import 'rxjs/add/operator/onErrorResumeNext';
import 'rxjs/add/operator/toArray';

const responsefilterfunctions = {
    'standard': (feed) => {
        if (typeof feed['channel']['item'] !== 'undefined') {
            if (Array.isArray(feed['channel']['item']))
                return feed['channel']['item']
            else return [feed['channel']['item']]
        }
        else
            if (typeof feed['item'] !== 'undefined') {
                if (Array.isArray(feed['item']))
                    return feed['item']
                else return [feed['item']]
            } else
                return [];
    },
    'entry': (feed) => {
        if (typeof feed['entry'] !== 'undefined') {
            if (Array.isArray(feed['entry']))
                return feed['entry']
            else return [feed['entry']]
        }
        else return [];
    }
};

const itemfilterfunctions = {

    'standard': (item) => {
        return new Promise<Object>((resolve, reject) => {

            // get the pubdate converted, move this to the service
            let pubTime = new Date(item['pubDate']).getTime();
            if (isNaN(pubTime)) pubTime = Date.now();
            item['pubTime'] = pubTime;

            let img = item['defaultthumb'];

            // fixing the description of some
            if (item['feedlabel'].indexOf('Ars Technica') > -1) item['description'] = item['content:encoded'];
            if (item['feedlabel'].indexOf('BankingTech') > -1) item['description'] = item['content:encoded'];
            if (item['feedlabel'].indexOf('CFI.co') > -1) item['description'] = item['content:encoded'];

            // check on content - TODO: for all requierd fields
            if (typeof item['description'] === 'undefined')
                item['description'] = 'No description found - error in feed ' + item['feedlabel'];

            let urls;
            // these feeds have their thumbnail references in content:encoded instead of the description
            if ((item['feedlabel'] == 'Design Milk') ||
                (item['feedlabel'] == 'VentureBeat'))
                urls = (<string>item['content:encoded']).match(/\b(http|https)?(:\/\/)?(\S*)\.(\w{2,4})\b/ig);
            else urls = (<string>item['description']).match(/\b(http|https)?(:\/\/)?(\S*)\.(\w{2,4})\b/ig);
            if (urls)
                (<Array<string>>urls).map((item: string) => {
                    if ((item.toLowerCase().indexOf('gif') > -1) ||
                        (item.toLowerCase().indexOf('jpg') > -1) ||
                        (item.toLowerCase().indexOf('jpeg') > -1) ||
                        (item.toLowerCase().indexOf('png') > -1))
                        img = item.replace('\"', '')
                            .replace('src=', '')
                            .replace('href=', '')
                });

            // for some of the feeds who put images in enclosures or other nested elements
            ['enclosure', 'dc:image', 'media:content', 'media:thumbnail'].map(key => {
                if (typeof item[key] !== 'undefined')
                    if (typeof item[key]['url'] !== 'undefined')
                        img = item[key]['url'];
            });

            // another example of an odd place to find thumbnails
            if (typeof item['media:group'] !== 'undefined')
                if (typeof item['media:group']['media:content'] !== 'undefined')
                    if (Array.isArray(item['media:group']['media:content']))
                        img = item['media:group']['media:content'][0]['url']

            // but if the feed has the thumbnail in thumbnail, take that one!
            if (typeof item['thumbnail'] !== 'undefined') img = item['thumbnail'];

            // clean the HTML from description as well as some specific filters
            // do this after the search of images in description
            item['description'] = <string>item['description']
                .replace(/<(?:.|\n)*?>/gm, '');

            // title fix - if it is too long
            if (item['feedlabel'].indexOf('Twitter') > -1)
                item['title'] = item['description'].substring(0, 1000);

            // return the promise result
            resolve(Object.assign(item,
                {
                    thumbnail: img
                }
            ));
        })
    },

    'deferred': (item) => {
        return new Promise<Object>((resolve, reject) => {

            // try to open the link page and parse html for thumbnail retrieval
            let url = item['link'];

            // get the pubdate converted, move this to the service
            let pubTime = new Date(item['pubDate']).getTime();
            if (isNaN(pubTime)) pubTime = Date.now();
            item['pubTime'] = pubTime;

            this.http.get(url)
                .map(res => res.text())
                .subscribe((response) => {

                    let img = item['defaultthumb'];

                    // clean the HTML from description
                    item['description'] = <string>item['description']
                        .replace(/<(?:.|\n)*?>/gm, '')
                        .replace('Continue reading...', '');

                    // Bright specific stuff
                    if (item['feedlabel'] == 'Bright') {
                        let pos = response.indexOf('srcset');
                        img = 'assets/img/bright.jpg';

                        let searchtext = response.substring(pos, pos + 500);
                        let urls = searchtext.match(/\b(http|https)?(:\/\/)?(\S*)\.(\w{2,4})\b/ig);
                        if (urls)
                            (<Array<string>>urls).map((item: string) => {
                                if ((item.toLowerCase().indexOf('src=') > -1))
                                    img = item
                                        .replace('\"', '')
                                        .replace('src=', '');
                            });
                    }

                    // and return the value for the feed
                    resolve(Object.assign(item,
                        {
                            thumbnail: img
                        }));
                });
        })
    }
}

@Injectable()
export class NewsAggregatorService {

    private counter = 0;
    private totalcount = 0;

    constructor(
        private http: Http,
        private events: Events
    ) { };

    loadRSSFeeds(feeds) {


        // taken from the internet, somewhere
        function hashCode(txt) {
            return txt.split("").reduce(function (a, b) { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0);
        }

        //  console.log('FEEDS', feeds);

        // counters for progress indicator
        this.counter = 0;
        this.totalcount = feeds.length;

        // the array which contains all the Observables for the feeds we are interested in
        let feedsArray = [];

        // lets go through all the active feeds and create and observable for it
        feeds.map(feed => {

            //let item = Observable.from(this.http.get(feed['feedurl'], {}, {}))  // for native HTTP
            let item =
                this.http.get(feed['feedurl'])

                    .timeout(5000)
                    .do(() => {
                        this.events.publish('progress', { 'value': this.counter, 'total': this.totalcount - 1, 'text': feed['prettylabel'], error: true });
                        this.events.publish('progress', { 'value': this.counter, 'total': this.totalcount - 1, 'text': '..' });
                        this.counter += 1;
                    })
                    .catch((error: any) => {
                        this.events.publish('progress', { 'value': this.counter, 'total': this.totalcount - 1, 'text': error.toString() + ' ' + feed['feedurl'], 'error': true });
                        this.counter += 1;
                        return Observable.throw(error.json().error || 'Server error')
                    })
                    .filter(input => { return (input.ok && (input.status == 200)) })
                    .map(rawinput => {
                        let itemlist;
                        try {
                            let newsinput = XML.parse(rawinput.text());
                            itemlist = responsefilterfunctions[feed['responsefilter']](newsinput);
                        }
                        catch (err) {
                            // there is an error in the XML parse, pass an empty feed
                            itemlist = []
                        }
                        //          console.log('1', itemlist, typeof itemlist, Array.isArray(itemlist), itemlist.length);
                        return itemlist;
                    })

                    // .do(item => { console.log('3', item) })
                    .mergeAll()
                    // .do(item => { console.log('4', item) })
                    .map(item => {
                        //   console.log('2', item)

                        // we are going to clean some words
                        let cleanWords = feed['clearWords'];
                        if (Array.isArray(cleanWords))
                            cleanWords.map(word => {
                                while (item['title'].indexOf(word) > -1)
                                    item['title'] = item['title'].replace(word, '');
                            });

                        // add some data
                        item['defaultthumb'] = feed['defaultthumb'];
                        item['prettylabel'] = feed['prettylabel'];
                        item['feedlabel'] = feed['feedlabel'];
                        item['hashcode'] = hashCode(item['title'].replace(/ /g,''));
                        item['itemfilter'] = feed['itemfilter'];

                        return item;//Object.assign({}, item);
                    })
                    // .do(item => { console.log('5', item, item['itemfilter']) })
                    .flatMap(item => itemfilterfunctions[item['itemfilter']](item))
                    //   .do(item => { console.log('6', item) })
                    .onErrorResumeNext()
            //            );

            // add the feed observable to the array
            feedsArray.push(item);
        });


        //console.log('FEEDS2', feedsArray);
        // and we are going to return an Observable that iterates through all the observables in the array once subscribed to 
        return Observable.from(feedsArray)
            //  .map((value) => { return Observable.from(value).delay(750); })// every x ms through the feeds 
            .concatAll();
    }
}
