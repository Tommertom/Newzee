//import { Debug } from './debug';
import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import * as XML from 'pixl-xml';
//import { HTTP } from '@ionic-native/http';

import { Events } from 'ionic-angular';

import { Observable } from "rxjs/Rx";

/* 

thepaypers.com  ->http://www.thepaypers.com/syndication
http://feeds.feedburner.com/thepaypers/cfKW Headlines
http://feeds.feedburner.com/ThePaypersOnlinePayments
http://feeds.feedburner.com/ThePaypersMobilePayments
http://feeds.feedburner.com/ThePaypersE-invoicing
http://feeds.feedburner.com/ThePaypersOnlineBanking
http://feeds.feedburner.com/ThePaypersE-commerce
http://feeds.feedburner.com/ThePaypersE-identity
http://feeds.feedburner.com/ThePaypersCards
http://feeds.feedburner.com/ThePaypersOther
http://feeds.feedburner.com/ThePaypersReports
http://feeds.feedburner.com/ThePaypersBriefs
http://feeds.feedburner.com/ThePaypersCompanyProfiles
http://feeds.feedburner.com/ThePaypersAnalysis




informationweek.com - http://www.informationweek.com/whitepaper/rss
http://www.informationweek.com/rss_simple.asp
http://www.informationweek.com/whitepaper/rss

finovate.com

finextra.com

darkreading.com

coindesk.com

bankinnovation.net

http://www.theeastafrican.co.ke/news/2558-2558-view-asFeed-kht4fy/index.xml
 
*/

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

//        console.log("GETTING FEED ON ENTYR", feed);

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

            // title fix
            if (item['feedlabel'].indexOf('Twitter') > -1)
                item['title'] = item['description'].substring(0, 1000);

            // some text cleaning for Huffington Post
            if (item['feedlabel'].indexOf('Huffington') > -1)
                item['description'] = item['description']
                    .substring(item['description']
                        .indexOf('Vidible);') + 'Vidible);'.length);

            //        if (item['feedlabel'].indexOf('American Banker') > -1)
            //       console.log('DEBUG item...', item, item['description']);

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

    //   private newsFeed: Array<Object> = []; // all the feeds stored as objects
    private activeFeeds: Object = {}; // feeds that are to be loaded
    private activeNewsLoop: boolean = true;
    private feedCollection: Array<Object> = [];

    private counter = 0;
    private totalcount = 0;
    private activeFeedCollection = [];

    constructor(
        private http: Http,//HTTP, // Http,// HTTP,//Http, // HTTP, //Http,
        //    private debug: Debug,
        private events: Events
    ) {
    };

    setFeeds(feeds) {
        this.feedCollection = feeds;
    }

    // set the active services to be loading
    setActiveServices(servicesettings) {
        this.activeFeeds = servicesettings;
    };

    setLoading(value) {
        this.activeNewsLoop = value;
    }

    doFullRefresh() {
        // taken from the internet, somewhere
        function hashCode(txt) {
            return txt.split("").reduce(function (a, b) { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0);
        }

        // filter to get only the active ones
        this.activeFeedCollection = this.feedCollection.filter(feed => {
            return this.activeFeeds[feed['feedlabel']]
        })

        // counters for progress
        this.counter = 0;
        this.totalcount = this.activeFeedCollection.length;

        // lets go through all the active feeds and create and observable for it
        let feedsArray = [];
        this.activeFeedCollection.map(ft => {
            //let item = Observable.from(this.http.get(ft['feedurl'], {}, {}))
                let item = this.http.get(ft['feedurl'])
                .catch((error: any) => {
                    this.events.publish('progress', { 'value': this.counter, 'total': this.totalcount - 1, 'text': error.toString() + ' ' + ft['feedurl'], 'error': true });
                    this.counter += 1;
                    return Observable.throw(error.json().error || 'Server error')
                })
                .filter(input => { return (input.ok && (input.status == 200)) })
                .map(rawinput => {
                    let itemlist;
                    try {
                        let newsinput = XML.parse(rawinput.text());
                        itemlist = responsefilterfunctions[ft['responsefilter']](newsinput);
                    }
                    catch (err) {
                        // there is an error in the XML parse, pass an empty feed
                        itemlist = []
                    }
                    return itemlist;
                })
                .do(() => {
                 //   console.log('SSSTTT', this.counter, this.totalcount - 1)
                    this.events.publish('progress', { 'value': this.counter, 'total': this.totalcount - 1, 'text': '..' });
                    this.counter += 1;
                })
                // we want progress per feed
                //    .do((val) => {
                //  console.log('SSSTTT', this.counter, this.totalcount - 1, val['feedlabel'])
                //      this.events.publish('progress', { 'value': this.counter, 'total': this.totalcount - 1, 'text': val['feedlabel'] });
                //   })
                // and now we are going to process them per item
                .mergeAll()
                // per item, we will enrich the content
                .map(item => {
                    // we are going to clean some words
                    let cleanWords = ft['clearWords'];
                    if (Array.isArray(cleanWords))
                        cleanWords.map(word => {
                            while (item['title'].indexOf(word) > -1)
                                item['title'] = item['title'].replace(word, '');
                        });

                    // build a wrapper for the content
                    let itemwrapper = {
                        newsservice: '',
                        defaultthumb: ft['defaultthumb'],
                        prettylabel: ft['prettylabel'],
                        feedlabel: ft['feedlabel'],
                        hashcode: hashCode(item['title']),
                        itemfilter: ft['itemfilter']
                    };

                    return Object.assign({}, item, itemwrapper)
                })
                .flatMap(item => itemfilterfunctions[item['itemfilter']](item))
                .onErrorResumeNext()

            // add the observable to the array
            feedsArray.push(item);
        });

        // and we are going to return an Observable that iterates every x ms through the feeds 
        return Observable.from(feedsArray)
            //  .map((value) => { return Observable.from(value).delay(750); })
            .concatAll();
    }
}
