module.exports = {
	extends: ['next/core-web-vitals'],
	settings: {
		next: {
			rootDir: 'github-release-reverse-proxy/',
		},
	},
	plugins: ['simple-import-sort'],
	rules: {
		'simple-import-sort/imports': 'error',
		'simple-import-sort/exports': 'error',
	},
};
