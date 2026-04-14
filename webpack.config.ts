import path from "path";
import { fileURLToPath } from "url";
import HtmlWebpackPlugin from "html-webpack-plugin";
import type { Configuration } from "webpack";
import "webpack-dev-server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config: Configuration = {
  entry: "./src/renderer/index.tsx",
  target: "web",
  output: {
    path: path.resolve(__dirname, "dist/renderer"),
    filename: "bundle.js",
    clean: true,
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./src/renderer/index.html",
    }),
  ],
  devServer: {
    port: 9000,
    hot: true,
  },
};

export default config;
