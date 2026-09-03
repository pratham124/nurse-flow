module.exports = function configureBabel(api) {
  api.cache(true);

  return {
    presets: [
      [
        "babel-preset-expo",
        {
          web: {
            unstable_transformImportMeta: true,
          },
        },
      ],
    ],
  };
};
