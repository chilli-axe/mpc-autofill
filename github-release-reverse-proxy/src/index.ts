export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const user = 'chilli-axe';
		const repo = 'mpc-autofill';
		const tag_name = 'latest';
		const platform = url.searchParams.get('platform');

		if (!platform) {
			return new Response('Missing required parameters: platform', { status: 400, statusText: 'Bad Request' });
		} else if (!(platform === 'windows' || platform === 'macos-intel' || platform === 'macos-arm' || platform === 'linux')) {
			return new Response(`Invalid platform ${platform}`, { status: 400, statusText: 'Bad Request' });
		}

		const fileName = `autofill-${platform}.zip`;
		const downloadUrl = `https://github.com/${user}/${repo}/releases/${tag_name}/download/${fileName}`;
		console.log('url', downloadUrl);

		return new Response(await (await fetch(downloadUrl)).arrayBuffer(), {
			headers: {
				...(request.headers.has('Access-Control-Request-Headers')
					? { 'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers')! }
					: {}),
				'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Max-Age': '300',
				'Content-Disposition': `inline; filename="${fileName}"`,
				'Access-Control-Expose-Headers': 'Content-Disposition',
				'content-type': 'application/octet-stream',
			},
		});
	},
};
