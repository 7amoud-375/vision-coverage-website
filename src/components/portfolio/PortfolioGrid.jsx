import PortfolioCard from './PortfolioCard'

export default function PortfolioGrid({ items, onOpen }) {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.id}>
          <PortfolioCard item={item} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  )
}
