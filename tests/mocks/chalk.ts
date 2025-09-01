// Mock implementation of chalk for testing
const createChainableStyle = () => {
  const style: any = (text: string) => text;
  return new Proxy(style, {
    get: () => style
  });
};

const chalk: any = createChainableStyle();
chalk.level = 3;

// Add color methods
const colors = [
  'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white', 'gray', 'grey',
  'blackBright', 'redBright', 'greenBright', 'yellowBright', 'blueBright', 'magentaBright', 'cyanBright', 'whiteBright',
  'bgBlack', 'bgRed', 'bgGreen', 'bgYellow', 'bgBlue', 'bgMagenta', 'bgCyan', 'bgWhite',
  'bgBlackBright', 'bgRedBright', 'bgGreenBright', 'bgYellowBright', 'bgBlueBright', 'bgMagentaBright', 'bgCyanBright', 'bgWhiteBright',
  'bold', 'dim', 'italic', 'underline', 'inverse', 'hidden', 'strikethrough', 'visible'
];

colors.forEach(color => {
  chalk[color] = createChainableStyle();
});

export default chalk;