import path from 'path';
import fs from 'fs/promises';
import {bundle} from '@remotion/bundler';
import {S3Client, PutObjectCommand, ObjectCannedACL} from '@aws-sdk/client-s3';
import {getVerse} from '../utils/getVerse';
import {getStock} from './stocks';
import {renderVideo} from './render';
import {getTheme} from './theme';
import {publishToFB} from './publish';
import {Verse} from '../utils/types';
import {outputType, stockProvider} from './pipe';
import {readFileSync} from 'fs';

let props: {[key: string]: string} = {};

try {
	props = JSON.parse(readFileSync('input-props.json', 'utf-8'));
	if (Object.keys(props).length > 0) {
		console.log('Input Props Detected', props);
	}
} catch (error) {}

const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID as string;
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY as string;

const s3 = new S3Client({
	credentials: {
		accessKeyId: S3_ACCESS_KEY_ID,
		secretAccessKey: S3_SECRET_ACCESS_KEY,
	},
	region: 'eu-north-1',
});

(async () => {
	// Remotion bundle location
	const bundleLocation = await bundle({
		entryPoint: path.join(process.cwd(), 'src/index.ts'),
		webpackOverride: (config) => config,
	});

	// Fetching a verse
	const verse: Verse = await getVerse({
		surah: props.surah ? Number(props.surah) : undefined,
		from: props.from ? Number(props.from) : undefined,
		to: props.to ? Number(props.to) : undefined,
	});

	console.log(verse.duration);

	// Verse data extraction
	const {surah} = verse;
	const verses = [...Array(verse.to - verse.from + 1)].map(
		(e, i) => verse.from + i
	);

	console.log(
		`Verse Picked: Surah ${surah}, from ${verses[0]} to ${
			verses[verses.length - 1]
		}, duration: ${verse.duration}`
	);

	// Choosing theme for the video
	let theme = '';
	if (!props.video) {
		theme = await getTheme(verse.verse);
	}
	console.log('Chosen theme:', theme);

	let valid = false;
	do {
		const stockVideosProvider: stockProvider = 'PIXABAY';
		let url = '';
		if (props.video) {
			url = props.video;
			console.log(`Prop Video: ${url}`);
		} else {
			url = (await getStock(theme, verse.duration, stockVideosProvider)).url;
			console.log(`${stockVideosProvider} Video: ${url}`);
		}

		if (url) {
			const outputType = (props.outputType as outputType) || 'reel';
			console.log('renderVideo');
			const fileName = await renderVideo(
				bundleLocation,
				surah,
				verses,
				url,
				outputType
			);

			console.log('Video Rendering Done');

			const file = await fs.readFile(
				path.join(__dirname, '../out/' + fileName)
			);

			const params = {
				Bucket: 'tafakor',
				Key: 'videos' + '/' + fileName,
				Body: file,
				ACL: ObjectCannedACL.public_read,
			};

			// Push To S3
			await s3.send(new PutObjectCommand(params));

			const fileUrl = `https://tafakor.s3.eu-north-1.amazonaws.com/videos/${fileName}`;
			console.log(`Uploaded to S3: ${fileUrl}`);

			// Publish to FB
			console.log('Publishing Video to FB');
			const publishStatus = await publishToFB(fileUrl, outputType);
			if (publishStatus) {
				console.log('Video Published to FB');
			} else {
				console.log('Publishing Failed');
			}

			valid = true;
			process.exit();
		} else {
			continue;
		}
	} while (!valid);
})();
