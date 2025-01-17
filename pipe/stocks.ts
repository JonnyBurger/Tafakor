import {createClient, Videos} from 'pexels';
import {stockProvider} from './pipe';

const PEXELS_KEY = process.env.PEXELS_KEY as string;
const PIXABAY_KEY = process.env.PIXABAY_KEY as string;

/**
 * @description gets video with the closest duration to the targeted duration
 * @param videos - videos array
 * @param targetDuration - video targeted duration
 */
const closestDurationVideo = (
	videos: {duration: number}[],
	targetDuration: number
) => {
	let video: any;
	const videosCorrelations = videos.map((video, index) => ({
		video,
		correlation: video.duration - targetDuration,
	}));

	try {
		video = videosCorrelations
			.filter((duration) => duration.correlation > 0)
			.sort((a, b) => a.correlation - b.correlation)[0].video;
	} catch (error) {
		console.log('Long Videos not availabe: falling back to shorter videos');
		video = videosCorrelations
			.filter((duration) => duration.correlation < 0)
			.sort((a, b) => b.correlation - a.correlation)[0].video;
	}

	return video;
};

/**
 * @description returns a suiteable stock video
 * @param query - video search query
 * @param duration - video duration
 */
const pexelsStock = async (query: string, duration: number) => {
	let page = 1;
	let resLength = 0;
	const videos = [];
	do {
		console.log('Page:', page);
		const res: Videos = (await createClient(PEXELS_KEY).videos.search({
			query,
			per_page: 80,
			page,
		})) as Videos;
		page++;

		videos.push(...res.videos);
		resLength = res.videos.length;
	} while (resLength > 0 && page < 3);

	const video = closestDurationVideo(videos, duration);

	// Video URL
	const videoUrl = video.video_files.find(
		(video: any) => video.quality === 'hd'
	)?.link;

	return {
		url: videoUrl as string,
		duration: video.duration,
	};
};

/**
 * @description returns a suiteable stock video
 * @param query - video search query
 * @param duration - video duration
 */

const pixabayStock = async (query: string, duration: number) => {
	let page = 1;
	let resLength = 0;
	const videos = [];
	do {
		console.log('Page:', page);
		const res = await (
			await fetch(
				`https://pixabay.com/api/videos?key=${PIXABAY_KEY}&q=${query}&video_type=film&safesearch=true&per_page=200&page=${page}`,
				{method: 'GET', redirect: 'follow'}
			)
		).json();
		page++;

		videos.push(...res.hits);
		resLength = res.hits.length;
	} while (resLength > 0 && page <= 3);

	const video = closestDurationVideo(videos, duration);

	// Video URL
	const videoUrl = video.videos['medium'].url;

	return {
		url: videoUrl,
		duration: video.duration,
	};
};

/**
 *
 * @param query - Videos search query
 * @param duration - Video duration
 */
const getStock = (query: string, duration: number, provider: stockProvider) => {
	switch (provider) {
		case 'PEXELS':
			return pexelsStock(query, duration);

		case 'PIXABAY':
			return pixabayStock(query, duration);

		default:
			return pixabayStock(query, duration);
	}
};

export {getStock};
