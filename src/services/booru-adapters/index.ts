import type { BooruSource } from '../../types/post';
import { danbooruAdapter } from './danbooru';
import { gelbooruAdapter, rule34Adapter, safebooruAdapter } from './gelbooru';
import { yandereAdapter } from './yandere';

export const booruAdapters = { danbooru: danbooruAdapter, gelbooru: gelbooruAdapter, safebooru: safebooruAdapter, yandere: yandereAdapter, rule34: rule34Adapter };
export const booruSources = Object.values(booruAdapters);
export const getBooruAdapter = (source: BooruSource) => booruAdapters[source];
