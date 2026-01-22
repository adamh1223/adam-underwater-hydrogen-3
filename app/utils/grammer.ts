export const capitalizeFirstLetter = (word: string) => {
  return word.charAt(0).toUpperCase() + word.slice(1);
};

export const replaceSpacesWithDashes = (name: string | undefined) => {
  return name?.replace(/ /g,'-')
}