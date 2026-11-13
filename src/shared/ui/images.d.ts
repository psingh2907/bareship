// Image files imported as modules (`import logo from './logo.png'`): Metro turns them into an asset source.
declare module '*.png' {
  const source: import('react-native').ImageSourcePropType;
  export default source;
}
