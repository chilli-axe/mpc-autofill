const path = require("path");
const webpack = require("webpack"); // to access built-in plugins
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
  mode: "production",
  entry: {
    index: "./cardpicker/frontend/js/index.js",
    review: "./cardpicker/frontend/js/review.js",
    new: "./cardpicker/frontend/js/new.js",
    static_page: "./cardpicker/frontend/js/static_page.js",
    editor: "./cardpicker/frontend/js/editor.tsx",
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  output: {
    filename: "js/[name].bundle.js",
    path: path.resolve(__dirname, "./cardpicker/static"),
    library: ["Library", "[name]"],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env", "@babel/preset-react"],
          },
        },
      },
      {
        test: /\.(s?css)$/,
        use: [
          MiniCssExtractPlugin.loader,
          "css-loader",
          {
            loader: "postcss-loader",
            options: {
              postcssOptions: {
                plugins: () => [require("autoprefixer")],
              },
            },
          },
          "sass-loader",
        ],
      },
    ],
  },
  plugins: [
    // new BundleAnalyzerPlugin(),
    new webpack.ProvidePlugin({ $: "jquery", jQuery: "jquery" }),
    new MiniCssExtractPlugin({ filename: "css/[name].bundle.css" }),
  ],
};
