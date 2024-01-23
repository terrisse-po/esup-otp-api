import * as utils from '../../services/utils.js';
import * as properties from '../../properties/properties.js';
import * as errors from '../../services/errors.js';
import ldapjs from 'ldapjs-promise';

import { getInstance } from '../../services/logger.js';
const logger = getInstance();

/**
 * @type ldapjs.Client
 */
let client;

export async function initialize() {
    logger.info(utils.getFileNameFromUrl(import.meta.url) + ' Initializing ldap connection');
    client = ldapjs.createClient({
        url: getLdapProperties().uri
    });
    await client.bind(getLdapProperties().adminDn, getLdapProperties().password);
    logger.info(utils.getFileNameFromUrl(import.meta.url) + ' Ldap connection Initialized');
}

export async function find_user(uid) {
    let user;
    try {
        user = await find_user_internal(uid);
    } catch (error) {
        if (!(error instanceof ldapjs.NoSuchObjectError)) {
            throw error;
        }
    }
    return user || errors.UserNotFoundError.throw();
}

const modifiableAttributes = [getSmsAttribute(), getMailAttribute()];
const allAttributes = modifiableAttributes.concat("uid");

/**
 * @returns the user, or undefined
 */
async function find_user_internal(uid) {
    /** @type ldapjs.SearchOptions */
    const opts = {
        filter: new ldapjs.EqualityFilter({ attribute: 'uid', value: uid }),
        scope: 'sub',
        attributes: allAttributes
    };

    const searchResult = await client.searchReturnAll(getBaseDn(), opts);
    const searchEntry = searchResult.entries[0];

    if (!searchEntry) {
        return;
    }

    const user = {};
    for (const attribute of searchEntry.attributes) {
        const attributeName = attribute.type;
        if (allAttributes.includes(attributeName)) {
            user[attributeName] = attribute.values[0];
        }
    }

    return user;
}

function ldap_change(user) {
    const changes = [];

    for (const attr in user) {
        if (modifiableAttributes.includes(attr)) {
            const modif = new ldapjs.Attribute({ type: attr, values: user[attr] });
            const change = new ldapjs.Change({
                operation: 'replace',
                modification: modif
            });
            changes.push(change);
        }
    }
    return changes;
}

export function save_user(user) {
    const changes = ldap_change(user);
    return client.modify(getDN(user.uid), changes);
}

function getDN(uid) {
    return 'uid=' + uid + ',' + getBaseDn();
}

export function create_user(uid) {
    const entry = {
        cn: uid,
        uid: uid,
        sn: uid,
        [getMailAttribute()]: uid + '@univ.org',
        [getSmsAttribute()]: '0612345678',
        objectclass: ['inetOrgPerson']
    };
    return client.add(getDN(uid), entry);
}

export async function remove_user(uid) {
    return client.del(getDN(uid));
}

function getLdapProperties() {
    return properties.getEsupProperty('ldap');
}

function getBaseDn() {
    return getLdapProperties().baseDn;
}

function getTransportProperties() {
    return getLdapProperties().transport;
}

function getSmsAttribute() {
    return getTransportProperties().sms;
}

function getMailAttribute() {
    return getTransportProperties().mail;
}
