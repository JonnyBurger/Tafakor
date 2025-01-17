import {renderMedia, selectComposition} from '@remotion/renderer';
import {v4} from 'uuid';
import {outputType} from './pipe';
import {spawn} from 'child_process';
import path from 'path';

const SIZES = {
	reel: {
		width: 1080,
		height: 1920,
	},
	post: {
		width: 1000,
		height: 1000,
	},
};

/**
 * @description renders comp
 * @param bundleLocation - remotion bundle location
 * @param surah - surah number
 * @param verses - verses
 * @param footage - footage url
 */
const renderVideo = async (
	bundleLocation: string,
	surah: number,
	verses: number[],
	footage: string,
	outputType: outputType
) => {
	try {
		const ID = v4(); // Unique video id
		const compositionId = 'quran';

		// Composition props
		const inputProps = {
			surah,
			ayat: verses,
			footage,
			random: false,
			size: SIZES[outputType],
			outputType,
		};

		// Composition
		const composition = await selectComposition({
			serveUrl: bundleLocation,
			id: compositionId,
			inputProps,
			logLevel: 'verbose',
		});

		// Rendering progress bar init

		// Rendering Composition (mostly takes a while)
		await renderMedia({
			composition,
			serveUrl: bundleLocation,
			codec: 'h264',
			enforceAudioTrack: true,
			outputLocation: `out/${compositionId}-${ID}.mp4`,
			inputProps,
			timeoutInMilliseconds: 300000,
			onBrowserLog: (log) => {
				console.log(log);
			},
			logLevel: 'verbose',
			// Concurrency: 8,
			onProgress: ({progress, encodedFrames, renderedFrames}) => {
				// RenderingProgresss?.update({value: progress * 100});
				console.log(
					'Rendering Porgress:',
					renderedFrames,
					encodedFrames,
					progress * 100
				);
			},
			onStart: ({frameCount}) => {
				console.log('Total frames', frameCount);
			},
			onDownload: (src) => {
				console.log(`\nDownloading ${src} ...`);
				// Const downloadProgress = multiBar.add({total: 100});
				return ({percent, downloaded, totalSize}) => {
					if (percent !== null) {
						console.log('Downloading Porgress:', percent * 100);
						// DownloadProgress?.update({value: percent * 100});

						// const query = spawn('ls', [path.join(__dirname, '../out')]);
						// query.stdout.on('data', (data: {toString: () => string}) => {
						// 	console.log(data.toString());
						// });
					}
				};
			},
		});

		return `${compositionId}-${ID}.mp4`;
	} catch (error) {
		console.log(error);
		throw new Error('Video Rendering Error');
	}
};

export {renderVideo};
