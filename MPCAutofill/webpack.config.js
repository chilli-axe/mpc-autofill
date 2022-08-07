const path = require('path');
const webpack = require('webpack');  // to access built-in plugins

module.exports = {
  mode: 'development',
  entry: {
    base: './cardpicker/frontend/js/base.js',
    index: './cardpicker/frontend/js/index.js',
    review: './cardpicker/frontend/js/review.js',
    new: './cardpicker/frontend/js/new.js',
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, './cardpicker/static/js'),
    library: ['Library', '[name]'],
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
    ],
  },
  plugins: [
    new webpack.ProvidePlugin({$: 'jquery', jQuery: 'jquery'}),
    // new webpack.ProvidePlugin({popper: 'popperjs/core'}),
    new webpack.ProvidePlugin({bootstrap: 'bootstrap'}),
  ]
};
