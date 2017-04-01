import React, { Component, PropTypes } from 'react'
import ReactDOM from 'react-dom'
import Debug from 'debug'
import { AutoSizer, List } from 'react-virtualized/dist/commonjs/List'
import { Paper, Card, IconButton, CircularProgress } from 'material-ui'
import Carousel from './Carousel'
import PhotoDetail from './PhotoDetail'
import { formatDate } from '../../utils/datetime'
import PhotoListByDate from './PhotoListByDate'

const debug = Debug('component:photoApp:PhotoList')
const findPath = (items, path) => items.findIndex(item => item === path)
const findPhotosByDate = (photos, date) => photos.filter(photo => formatDate(photo.exifDateTime) === date)
const detectAllOffChecked = photoListByDates => photoListByDates.every(p => p.detectIsAllOffChecked())

export default class PhotoList extends Component {
  constructor(props) {
    super(props)

    this.state = {
      carouselItems: [],
      activeIndex: false
    }

    this.addListToSelection = (path) => {
      const hasPath = this.state.carouselItems.findIndex(item => item === path) >= 0

      !hasPath && this.setState(prevState => ({
        carouselItems: [
          ...prevState.carouselItems,
          path
        ]
      }))
    }
    this.removeListToSelection = (path) => {
      const hasPath = this.state.carouselItems.findIndex(item => item === path) >= 0

      hasPath && this.setState((prevState) => {
        const index = findPath(prevState.carouselItems, path)

        return {
          carouselItems: [
            ...prevState.carouselItems.slice(0, index),
            ...prevState.carouselItems.slice(index + 1)
          ]
        }
      })
    }
    this.lookPhotoDetail = (seqIndex, activeIndex) => {
      this.setState({ activeIndex })
      this.seqIndex = seqIndex
    }

    this.renderCarousel = () => {
      if (!this.state.carouselItems.length) return <div />
      debug('this.renderCarousel')
      return (
        <Paper
          style={{
            position: 'fixed',
            bottom: 15,
            width: '75%'
          }}
        >
          <Carousel
            ClearAll={() => this.setState({ carouselItems: [] })}
            removeListToSelection={this.removeListToSelection}
            style={{ backgroundColor: '#fff', height: 180, borderRadius: 4, boxShadow: '0 0 10px rgba(0,0,0,.3)' }}
            items={this.state.carouselItems}
          />
        </Paper>
      )
    }
    this.renderPhotoDetail = photos => photos.length && this.state.activeIndex !== false
        ? (<PhotoDetail
          closePhotoDetail={() => this.setState({ activeIndex: false })}
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%'
          }}
          items={photos[this.state.activeIndex].photos}
          seqIndex={this.seqIndex}
          activeIndex={this.state.activeIndex}
        />)
      : <div />
  }

  getChildContext() {
    return { photos: this.props.photoMapDates }
  }

  renderList = () => {
    // const AllHeight = []
    // this.props.photoMapDates.map((list, index) => AllHeight.push(Math.floor(list.photos.length / 7 + 1) * 204))
    // AllHeight.push(56)
    // debug('AllHeight', AllHeight)

    const list = (
      this.props.photoMapDates.map((list, index) => (
        <PhotoListByDate
          key={index.toString()}
          addListToSelection={this.addListToSelection}
          allPhotos={this.props.allPhotos}
          lookPhotoDetail={this.lookPhotoDetail}
          onAddHoverToList={(photoListByDates) => {
            this.photoListByDates = photoListByDates
            photoListByDates.forEach(p => p.addHoverToAllItem())
          }}
          onDetectAllOffChecked={detectAllOffChecked}
          onRemoveHoverToList={(photoListByDates) => {
            const isAllOffChecked = photoListByDates.every(p => p.detectIsAllOffChecked())
            isAllOffChecked && photoListByDates.forEach(p => p.removeHoverToAllItem())
          }}
          removeListToSelection={this.removeListToSelection}
          style={{ display: 'flex', flexFlow: 'row wrap', justifyContent: 'flex-start' }}
          photos={list.photos}
          date={list.date}
        />
      ))
    )
    debug('list', this.props)

    if (list.length === 0) return <div />

    const clientHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight
    const clientWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth

    const height = clientHeight - 56
    const width = this.props.leftNav ? clientWidth - 210 : clientWidth
    debug('width, height', width, height)

    const rowRenderer = ({ key, index, style }) => (
      <div
        key={key}
        style={style}
      >
        {list[index]}
      </div>
      )
    return (
      <List
        height={height}
        rowCount={list.length}
        rowHeight={204}
        rowRenderer={rowRenderer}
        width={width}
      />
    )
  }

  render() {
    // debug('render PhotoList, this.props', this.props)
    return (
      <Paper style={this.props.style}>
        {/* 图片列表 */}
        <this.renderList />
        {/*
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              overflow: 'auto'
            }}
          >
            {
              this.props.photoMapDates.map((list, index) => (
                <PhotoListByDate
                  key={index.toString()}
                  addListToSelection={this.addListToSelection}
                  allPhotos={this.props.allPhotos}
                  lookPhotoDetail={this.lookPhotoDetail}
                  onAddHoverToList={(photoListByDates) => {
                    this.photoListByDates = photoListByDates
                    photoListByDates.forEach(p => p.addHoverToAllItem())
                  }}
                  onDetectAllOffChecked={detectAllOffChecked}
                  onRemoveHoverToList={(photoListByDates) => {
                    const isAllOffChecked = photoListByDates.every(p => p.detectIsAllOffChecked())
                    isAllOffChecked && photoListByDates.forEach(p => p.removeHoverToAllItem())
                  }}
                  removeListToSelection={this.removeListToSelection}
                  style={{ display: 'flex', flexFlow: 'row wrap', justifyContent: 'flex-start' }}
                  ref={'photoListByDate'}
                  photos={list.photos}
                  date={list.date}
                />
              ))
            }
            {
              this.props.photoMapDates[0] && this.props.photoMapDates[0].photos[0].path ?
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16, height: 204}}>
                  ————————到底部啦！————————
                </div> : <div />
            }
          </div>

*/}
        {/* 轮播 */}
        {/* this.renderCarousel() */}
        { this.renderCarousel() }

        {/* 查看大图 */}
        { this.renderPhotoDetail(this.props.photoMapDates) }
      </Paper>
    )
  }
}

PhotoList.childContextTypes = {
  photos: PropTypes.array.isRequired
}
